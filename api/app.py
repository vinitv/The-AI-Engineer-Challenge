# Import required FastAPI components for building the API
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
# Import Pydantic for data validation and settings management
from pydantic import BaseModel
# Import OpenAI client for interacting with OpenAI's API
from openai import OpenAI
import os
from typing import Optional, List
from aimakerspace import vectordatabase, text_utils
import tempfile
import uuid
from aimakerspace.text_utils import PDFLoader, CharacterTextSplitter
import asyncio
import glob

# Initialize FastAPI application with a title
app = FastAPI(title="California Real Estate Assistant API")

# Configure CORS (Cross-Origin Resource Sharing) middleware
# This allows the API to be accessed from different domains/origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from any origin
    allow_credentials=True,  # Allows cookies to be included in requests
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers in requests
)

# Define the data model for chat requests using Pydantic
# This ensures incoming request data is properly validated
class ChatRequest(BaseModel):
    developer_message: str  # Message from the developer/system
    user_message: str      # Message from the user
    model: Optional[str] = "gpt-4.1-mini"  # Optional model selection with default
    api_key: str          # OpenAI API key for authentication

# In-memory store for indexed documents (for demo purposes)
doc_store = {}  # doc_id -> {"chunks": List[str], "api_key": str, "filename": str}
california_re_docs = {}  # Store for pre-loaded California real estate documents

# Pre-load California real estate PDFs on startup
def load_california_re_documents():
    """Pre-load California real estate PDFs from the files directory"""
    files_dir = "../files"  # Relative to api directory
    pdf_files = glob.glob(f"{files_dir}/*.pdf")
    
    for pdf_file in pdf_files:
        try:
            filename = os.path.basename(pdf_file)
            print(f"Loading California RE document: {filename}")
            
            # Extract text from PDF
            loader = PDFLoader(pdf_file)
            documents = loader.load_documents()
            splitter = CharacterTextSplitter()
            chunks = splitter.split_texts(documents)
            
            # Store with a special prefix for California RE docs
            doc_id = f"cal_re_{filename.replace('.pdf', '')}"
            california_re_docs[doc_id] = {
                "chunks": chunks,
                "filename": filename,
                "type": "california_re"
            }
            print(f"Successfully loaded {len(chunks)} chunks from {filename}")
            
        except Exception as e:
            print(f"Error loading {pdf_file}: {e}")

# Load California RE documents on startup
load_california_re_documents()

@app.post("/api/upload")
async def upload_pdfs(files: List[UploadFile] = File(...), api_key: str = Form(...)):
    """
    Upload multiple PDF files, extract and chunk text, store in memory.
    Returns document IDs for future chat queries.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")
    
    uploaded_docs = []
    
    for file in files:
        if not file.filename or not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail=f"Only PDF files are supported. Got: {file.filename}")
        
        try:
            # Save uploaded file to a temp location
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(await file.read())
                tmp_path = tmp.name
            
            # Extract text from PDF
            loader = PDFLoader(tmp_path)
            documents = loader.load_documents()
            splitter = CharacterTextSplitter()
            chunks = splitter.split_texts(documents)
            
            # Store chunks and API key in memory
            doc_id = str(uuid.uuid4())
            doc_store[doc_id] = {
                "chunks": chunks, 
                "api_key": api_key,
                "filename": file.filename,
                "type": "user_upload"
            }
            
            uploaded_docs.append({
                "doc_id": doc_id,
                "filename": file.filename,
                "chunks_count": len(chunks)
            })
            
            # Clean up temp file
            os.unlink(tmp_path)
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to process PDF {file.filename}: {e}")
    
    return {"uploaded_docs": uploaded_docs}

class RAGChatRequest(BaseModel):
    doc_ids: List[str]  # List of document IDs to search across
    user_message: str
    developer_message: Optional[str] = None
    model: Optional[str] = "gpt-4.1-mini"
    api_key: str

@app.post("/api/rag_chat")
async def rag_chat(request: RAGChatRequest):
    """
    Chat with indexed PDFs using RAG pipeline, including California real estate documents.
    """
    # Validate API key first
    if not request.api_key or not request.api_key.strip():
        raise HTTPException(status_code=400, detail="API key is required.")
    
    all_chunks = []
    api_key = None
    
    # Collect chunks from all specified documents
    for doc_id in request.doc_ids:
        # Check user uploaded documents
        doc_data = doc_store.get(doc_id)
        if doc_data:
            all_chunks.extend(doc_data["chunks"])
            api_key = doc_data["api_key"]
        else:
            # Check California RE documents
            cal_doc_data = california_re_docs.get(doc_id)
            if cal_doc_data:
                all_chunks.extend(cal_doc_data["chunks"])
                # For California RE docs, use the provided API key
                api_key = request.api_key
            else:
                raise HTTPException(status_code=404, detail=f"Document {doc_id} not found.")
    
    if not all_chunks:
        raise HTTPException(status_code=400, detail="No document content found.")
    
    # Create embeddings on-demand for RAG
    try:
        # Set environment variable for the embedding model
        if api_key:
            os.environ["OPENAI_API_KEY"] = api_key
        
        # Create vector database with embeddings
        db = vectordatabase.VectorDatabase()
        db = await db.abuild_from_list(all_chunks)
        
        # Retrieve relevant context from the PDFs
        top_k = 5  # Increased for better context
        results = db.search_by_text(request.user_message, k=top_k, return_as_text=True)
        context_text = "\n".join(results)  # type: ignore
        
        # Default system message for California real estate
        default_system_message = """You are a knowledgeable California real estate assistant. You have access to California real estate law documents, regulations, and administrative codes. 

Your role is to:
1. Answer questions about California real estate law, regulations, and procedures
2. Provide accurate information based on the provided documents
3. Help users understand real estate transactions, licensing, and compliance
4. Cite relevant sections from the documents when possible
5. Be professional, clear, and helpful

Always base your answers on the provided document context and California real estate law."""
        
        system_message = request.developer_message if request.developer_message else default_system_message
        
        # Compose prompt for OpenAI
        prompt = f"{system_message}\n\nContext from documents:\n{context_text}\n\nUser question: {request.user_message}"
        
        client = OpenAI(api_key=api_key)
        model_name = request.model if request.model else "gpt-4.1-mini"
        stream = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": prompt},
            ],
            stream=True
        )
        async def generate():
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
        return StreamingResponse(generate(), media_type="text/plain")
    except Exception as e:
        error_msg = str(e)
        if "invalid_api_key" in error_msg.lower() or "401" in error_msg:
            raise HTTPException(status_code=401, detail="Invalid OpenAI API key. Please check your API key and try again.")
        elif "quota" in error_msg.lower() or "billing" in error_msg.lower():
            raise HTTPException(status_code=402, detail="OpenAI API quota exceeded or billing issue. Please check your OpenAI account.")
        else:
            raise HTTPException(status_code=500, detail=f"Error processing request: {error_msg}")

@app.get("/api/available_docs")
async def get_available_documents():
    """Get list of available documents (both California RE and user uploaded)"""
    cal_docs = [
        {
            "doc_id": doc_id,
            "filename": data["filename"],
            "type": "california_re",
            "chunks_count": len(data["chunks"])
        }
        for doc_id, data in california_re_docs.items()
    ]
    
    user_docs = [
        {
            "doc_id": doc_id,
            "filename": data["filename"],
            "type": "user_upload",
            "chunks_count": len(data["chunks"])
        }
        for doc_id, data in doc_store.items()
    ]
    
    return {
        "california_re_documents": cal_docs,
        "user_documents": user_docs
    }

# Define the main chat endpoint that handles POST requests
@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        # Initialize OpenAI client with the provided API key
        client = OpenAI(api_key=request.api_key)
        
        # Create an async generator function for streaming responses
        async def generate():
            # Create a streaming chat completion request
            model_name = request.model if request.model else "gpt-4.1-mini"
            stream = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "developer", "content": request.developer_message},
                    {"role": "user", "content": request.user_message}
                ],
                stream=True  # Enable streaming response
            )
            
            # Yield each chunk of the response as it becomes available
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content

        # Return a streaming response to the client
        return StreamingResponse(generate(), media_type="text/plain")
    
    except Exception as e:
        # Handle any errors that occur during processing
        raise HTTPException(status_code=500, detail=str(e))

# Define a health check endpoint to verify API status
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# Entry point for running the application directly
if __name__ == "__main__":
    import uvicorn
    # Start the server on all network interfaces (0.0.0.0) on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
