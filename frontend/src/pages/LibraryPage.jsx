import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import DocumentCard from '../components/library/DocumentCard';
import UploadZone from '../components/library/UploadZone';
import Icon from '../components/common/Icon';
import * as documentsApi from '../api/documents';

export default function LibraryPage() {
  const { isAdmin } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [filter, setFilter] = useState('All');
  const [isLoading, setIsLoading] = useState(true);

  const loadDocuments = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const data = await documentsApi.getDocuments();
      setDocuments(data || []);
    } catch (e) {
      console.error('Failed to load documents:', e);
      setDocuments([]);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    loadDocuments(true);
  }, [loadDocuments]);

  // Poll background ingestion if any document is processing
  useEffect(() => {
    const hasPending = documents.some(d => d.status === 'Uploaded' || d.status === 'Processing');
    if (!hasPending) return;

    const interval = setInterval(() => {
      loadDocuments(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [documents, loadDocuments]);

  const handleDeleteDocument = (docId) => {
    setDocuments(prev => prev.filter(d => d.id !== docId));
  };

  // Get unique subjects for filter tabs
  const subjects = ['All', ...new Set(documents.map(d => d.subject).filter(Boolean))];

  const filteredDocs = filter === 'All' 
    ? documents 
    : documents.filter(d => d.subject === filter);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-on-surface">Your Study Library</h1>
          <p className="text-base text-on-surface-variant mt-1">
            Access all approved textbooks and curriculum materials.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => loadDocuments(true)}
            className="p-2 rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"
            title="Refresh Library"
          >
            <Icon name="refresh" />
          </button>
          <div className="flex items-center gap-2 text-sm text-on-surface-variant font-medium bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant/40">
            <Icon name="menu_book" style={{ fontSize: '18px' }} />
            <span>{documents.length} textbook{documents.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Admin upload zone */}
      {isAdmin && (
        <div className="mb-8">
          <UploadZone onUploadSuccess={() => loadDocuments(false)} />
        </div>
      )}

      {/* Filter tabs */}
      {subjects.length > 1 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {subjects.map(subject => (
            <button
              key={subject}
              onClick={() => setFilter(subject)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === subject 
                  ? 'bg-primary text-on-primary shadow-sm' 
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {subject}
            </button>
          ))}
        </div>
      )}

      {/* Documents grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-20 text-on-surface-variant bg-surface-container-lowest rounded-2xl border border-outline-variant/40">
          <Icon name="library_books" className="text-5xl mb-4 opacity-40 text-primary" />
          <p className="text-lg font-medium text-on-surface">No textbooks found</p>
          {isAdmin ? (
            <p className="text-sm mt-1 text-on-surface-variant">Upload PDF textbooks using the upload zone above.</p>
          ) : (
            <p className="text-sm mt-1 text-on-surface-variant">Ask your administrator to add curriculum textbooks.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocs.map(doc => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onDelete={handleDeleteDocument}
            />
          ))}
        </div>
      )}
    </div>
  );
}
