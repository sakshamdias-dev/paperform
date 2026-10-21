import { useState, useEffect } from 'react';
import { X, FolderEdit } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

interface SectionEditModalProps {
  isOpen?: boolean;
  sectionName: string;
  initialDescription?: string;
  sectionDescription?: string;
  onClose: () => void;
  onSave: (newName: string, newDescription: string) => void;
}

export default function SectionEditModal({
  isOpen,
  sectionName,
  initialDescription = '',
  sectionDescription,
  onClose,
  onSave,
}: SectionEditModalProps) {
  const [name, setName] = useState(sectionName);
  const [description, setDescription] = useState(sectionDescription ?? initialDescription);

  useEffect(() => {
    setName(sectionName);
    setDescription(sectionDescription ?? initialDescription);
  }, [sectionName, initialDescription, sectionDescription]);

  if (isOpen === false) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), description);
    onClose();
  };

  const modules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['clean'],
    ],
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 11000 }} onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580, width: '90vw' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FolderEdit size={18} color="#2563eb" />
            <h2 className="modal-title">Edit Section</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-content" style={{ padding: 20 }}>
          <div className="property-field" style={{ marginBottom: 16 }}>
            <label className="property-label">Section Title</label>
            <input
              type="text"
              autoFocus
              className="property-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Section A: Reading Comprehension"
            />
          </div>

          <div className="property-field">
            <label className="property-label">Section Description / Instructions (Formatted Text)</label>
            <div style={{ background: 'white', borderRadius: 6, border: '1px solid #cbd5e1' }}>
              <ReactQuill
                theme="snow"
                value={description}
                onChange={setDescription}
                modules={modules}
                placeholder="e.g. Answer all questions. Each question carries 2 marks."
              />
            </div>
            <p style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
              This formatted description will appear right below the section title on the canvas and in PDF/Print.
            </p>
          </div>
        </div>

        <div className="modal-actions" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!name.trim()}>Save Section</button>
        </div>
      </div>
    </div>
  );
}
