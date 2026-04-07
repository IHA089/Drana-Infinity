import os
import uuid
import sqlite3
from typing import List, Dict, Any, Optional

import chromadb
from chromadb.utils import embedding_functions
from flask import Blueprint, render_template, request, jsonify

DB_NAME = "chat_database.db"           
RAG_DB_DIR = "rag_chroma_db"          
RAG_UPLOAD_DIR = "rag_uploads"        

os.makedirs(RAG_DB_DIR, exist_ok=True)
os.makedirs(RAG_UPLOAD_DIR, exist_ok=True)

chroma_client = chromadb.PersistentClient(path=RAG_DB_DIR)
embedding_fn = embedding_functions.DefaultEmbeddingFunction()

rag_bp = Blueprint(
    "rag",
    __name__,
    template_folder="templates",
    static_folder="static",
)

def get_conn():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_rag_db():
    conn = get_conn()
    c = conn.cursor()

    c.execute(
        """
        CREATE TABLE IF NOT EXISTS rag_collections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            display_name TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    c.execute(
        """
        CREATE TABLE IF NOT EXISTS rag_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            collection_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            filepath TEXT NOT NULL,
            filetype TEXT,
            size_bytes INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(collection_id) REFERENCES rag_collections(id) ON DELETE CASCADE
        )
        """
    )

    conn.commit()
    conn.close()


def ensure_logged_in_user() -> Optional[str]:
    user_hash = request.cookies.get("user_hash")
    if not user_hash:
        return None
    return user_hash


def get_or_create_chroma_collection(user_hash: str, collection_row: sqlite3.Row):
    coll_id = collection_row["id"]
    base_name = collection_row["name"]
    chroma_name = f"user_{user_hash}_col_{coll_id}_{base_name}"
    return chroma_client.get_or_create_collection(
        name=chroma_name,
        embedding_function=embedding_fn,
    )


def simple_chunk(text: str, max_len: int = 800, overlap: int = 200) -> List[str]:
    text = text.replace("\r\n", "\n")
    chunks = []
    start = 0
    while start < len(text):
        end = start + max_len
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += max_len - overlap
    return chunks

@rag_bp.route("/rag")
def rag_ui():
    user_hash = request.cookies.get("user_hash")
    is_logged_in = bool(user_hash)
    return render_template("rag.html", is_logged_in=is_logged_in)

@rag_bp.route("/rag/api/collections", methods=["GET"])
def api_list_collections():
    user_hash = ensure_logged_in_user()
    if not user_hash:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    conn = get_conn()
    c = conn.cursor()
    c.execute(
        """
        SELECT rc.*,
               COUNT(rd.id) AS doc_count
        FROM rag_collections rc
        LEFT JOIN rag_documents rd ON rc.id = rd.collection_id
        WHERE rc.user_hash = ?
        GROUP BY rc.id
        ORDER BY rc.created_at DESC
        """,
        (user_hash,),
    )
    rows = c.fetchall()
    conn.close()

    collections = [
        {
            "id": row["id"],
            "name": row["name"],
            "display_name": row["display_name"],
            "description": row["description"] or "",
            "created_at": row["created_at"],
            "doc_count": row["doc_count"],
        }
        for row in rows
    ]
    return jsonify({"success": True, "collections": collections})


@rag_bp.route("/rag/api/collections", methods=["POST"])
def api_create_collection():
    user_hash = ensure_logged_in_user()
    if not user_hash:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    data = request.get_json(force=True)
    display_name = (data.get("display_name") or "").strip()
    description = (data.get("description") or "").strip()

    if not display_name:
        return jsonify({"success": False, "message": "Collection name is required"}), 400

    slug = (
        display_name.lower()
        .replace(" ", "_")
        .replace("-", "_")
        .replace("/", "_")
        .strip("_")
    )
    if not slug:
        slug = f"col_{uuid.uuid4().hex[:8]}"

    conn = get_conn()
    c = conn.cursor()
    c.execute(
        """
        INSERT INTO rag_collections (user_hash, name, display_name, description)
        VALUES (?, ?, ?, ?)
        """,
        (user_hash, slug, display_name, description),
    )
    conn.commit()
    new_id = c.lastrowid
    conn.close()

    return jsonify(
        {
            "success": True,
            "collection": {
                "id": new_id,
                "name": slug,
                "display_name": display_name,
                "description": description,
            },
        }
    )

@rag_bp.route("/rag/api/collections/<int:collection_id>/documents", methods=["GET"])
def api_list_documents(collection_id: int):
    user_hash = ensure_logged_in_user()
    if not user_hash:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    conn = get_conn()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    c.execute(
        "SELECT * FROM rag_collections WHERE id = ? AND user_hash = ?",
        (collection_id, user_hash),
    )
    col = c.fetchone()
    if not col:
        conn.close()
        return jsonify({"success": False, "message": "Collection not found"}), 404

    c.execute(
        """
        SELECT id, filename, filepath, filetype, size_bytes, created_at
        FROM rag_documents
        WHERE collection_id = ?
        ORDER BY created_at DESC
        """,
        (collection_id,),
    )
    rows = c.fetchall()
    conn.close()

    docs = [
        {
            "id": r["id"],
            "filename": r["filename"],
            "filepath": r["filepath"],
            "filetype": r["filetype"],
            "size_bytes": r["size_bytes"],
            "created_at": r["created_at"],
        }
        for r in rows
    ]
    return jsonify({"success": True, "documents": docs})


@rag_bp.route("/rag/api/upload", methods=["POST"])
def api_upload():
    user_hash = ensure_logged_in_user()
    if not user_hash:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    if "file" not in request.files:
        return jsonify({"success": False, "message": "No file part"}), 400
    files = request.files.getlist("file")

    collection_id = request.form.get("collection_id")
    if not collection_id:
        return jsonify({"success": False, "message": "collection_id required"}), 400

    conn = get_conn()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    c.execute(
        "SELECT * FROM rag_collections WHERE id = ? AND user_hash = ?",
        (collection_id, user_hash),
    )
    collection_row = c.fetchone()
    if not collection_row:
        conn.close()
        return jsonify({"success": False, "message": "Collection not found"}), 404

    chroma_collection = get_or_create_chroma_collection(user_hash, collection_row)

    stored_files = []

    for f in files:
        if f.filename == "":
            continue

        filename = f.filename
        safe_name = filename.replace("/", "_")
        user_dir = os.path.join(RAG_UPLOAD_DIR, user_hash)
        os.makedirs(user_dir, exist_ok=True)
        filepath = os.path.join(user_dir, safe_name)
        f.save(filepath)

        size_bytes = os.path.getsize(filepath)
        ext = os.path.splitext(filename)[1].lower().lstrip(".")

        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as fh:
                full_text = fh.read()
        except Exception:
            full_text = ""

        if full_text.strip():
            chunks = simple_chunk(full_text)
            ids = [str(uuid.uuid4()) for _ in chunks]
            metadatas = [
                {
                    "file_name": filename,
                    "collection_id": int(collection_id),
                    "user_hash": user_hash,
                    "chunk_index": idx,
                }
                for idx in range(len(chunks))
            ]
            chroma_collection.add(
                documents=chunks,
                ids=ids,
                metadatas=metadatas,
            )

        c.execute(
            """
            INSERT INTO rag_documents (collection_id, filename, filepath, filetype, size_bytes)
            VALUES (?, ?, ?, ?, ?)
            """,
            (collection_id, filename, filepath, ext, size_bytes),
        )
        stored_files.append(filename)

    conn.commit()
    conn.close()

    if not stored_files:
        return jsonify({"success": False, "message": "No valid files uploaded"}), 400

    return jsonify(
        {"success": True, "message": "Uploaded", "files": stored_files}
    )

@rag_bp.route("/rag/api/search", methods=["POST"])
def api_search():
    user_hash = ensure_logged_in_user()
    if not user_hash:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    data = request.get_json(force=True)
    query = (data.get("query") or "").strip()
    top_k = int(data.get("top_k") or 5)
    collection_ids = data.get("collection_ids") or []  

    if not query:
        return jsonify({"success": False, "message": "Query is required"}), 400

    conn = get_conn()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    if collection_ids:
        placeholders = ",".join("?" * len(collection_ids))
        c.execute(
            f"""
            SELECT *
            FROM rag_collections
            WHERE user_hash = ?
              AND id IN ({placeholders})
            """,
            (user_hash, *collection_ids),
        )
    else:
        c.execute(
            "SELECT * FROM rag_collections WHERE user_hash = ?",
            (user_hash,),
        )

    col_rows = c.fetchall()
    conn.close()

    results: List[Dict[str, Any]] = []

    for col in col_rows:
        coll = get_or_create_chroma_collection(user_hash, col)
        try:
            qres = coll.query(query_texts=[query], n_results=top_k)
        except Exception:
            continue

        docs = qres.get("documents", [[]])[0]
        metas = qres.get("metadatas", [[]])[0]
        dists = qres.get("distances", [[]])[0] if "distances" in qres else [None] * len(docs)

        for doc, meta, dist in zip(docs, metas, dists):
            results.append(
                {
                    "collection_id": col["id"],
                    "collection_name": col["display_name"],
                    "file_name": meta.get("file_name"),
                    "score": float(dist) if dist is not None else None,
                    "snippet": (doc[:400] + "…") if len(doc) > 400 else doc,
                }
            )

    results.sort(key=lambda r: (r["score"] if r["score"] is not None else 1e9))

    return jsonify({"success": True, "results": results})

def init_rag(app):
    init_rag_db()
    app.register_blueprint(rag_bp)

