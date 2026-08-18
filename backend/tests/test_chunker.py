from app.ingest.chunker import chunk_text, process_chunks

def test_chunking_size_and_overlap():
    text = "word " * 1000
    chunks = chunk_text(text, chunk_size=500, overlap=50)
    
    assert len(chunks) > 1
    assert len(chunks[0].split()) == 500
    
    # Check overlap
    chunk1_tokens = chunks[0].split()
    chunk2_tokens = chunks[1].split()
    
    # Last 50 of chunk1 should match first 50 of chunk2
    assert chunk1_tokens[-50:] == chunk2_tokens[:50]

def test_process_chunks():
    pages_data = [{"page_number": 1, "text": "Hello world " * 100}]
    meta = {"textbook_name": "TestBook", "standard": "Std_10", "subject": "Science"}
    chunks = process_chunks(pages_data, meta)
    
    assert len(chunks) > 0
    assert chunks[0]["metadata"]["subject"] == "Science"
    assert chunks[0]["metadata"]["page_number"] == 1
