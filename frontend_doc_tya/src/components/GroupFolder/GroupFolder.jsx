// src/components/GroupFolder/GroupFolder.jsx
import { useState, useEffect } from 'react';
import { getToken } from '../../api/auth';
import './GroupFolder.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

export default function GroupFolder() {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedFolder, setExpandedFolder] = useState(null);

  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/groups/folders/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Ошибка загрузки списка папок');
      const data = await res.json();
      setFolders(data.folders || []);
    } catch (err) {
      console.error('❌ Folders fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFolder = (folderName) => {
    setExpandedFolder(prev => prev === folderName ? null : folderName);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) return <div className="loading">🔄 Загрузка папок...</div>;
  if (error) return <div className="error">❌ {error}</div>;

  return (
    <div className="group-folder">
      <h2>🗂️ Папки групп</h2>
      
      {folders.length === 0 ? (
        <p className="empty">📭 Папок групп пока нет. Создайте группу, чтобы появилась папка.</p>
      ) : (
        <div className="folders-list">
          {folders.map(folder => (
            <div key={folder.name} className="folder-card">
              <div 
                className="folder-header"
                onClick={() => toggleFolder(folder.name)}
              >
                <span className="folder-icon">📁</span>
                <div className="folder-info">
                  <strong className="folder-name">{folder.name}</strong>
                  <span className="folder-meta">
                    {folder.files_count} файл(ов) • Создана: {formatDate(folder.created)}
                  </span>
                </div>
                <span className="folder-toggle">
                  {expandedFolder === folder.name ? '▲' : '▼'}
                </span>
              </div>
              
              {/* 🔹 Содержимое папки (раскрывается) */}
              {expandedFolder === folder.name && folder.files.length > 0 && (
                <div className="folder-contents">
                  <table className="files-table">
                    <thead>
                      <tr>
                        <th>Файл</th>
                        <th>Размер</th>
                        <th>Изменён</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {folder.files.map(file => (
                        <tr key={file.name}>
                          <td>
                            <span className="file-icon">📄</span>
                            {file.name}
                          </td>
                          <td>{formatFileSize(file.size)}</td>
                          <td>{formatDate(file.modified)}</td>
                          <td>
                            <a 
                              href={`${API_URL}${file.url}`} 
                              download 
                              className="btn-download"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              ⬇️ Скачать
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {expandedFolder === folder.name && folder.files.length === 0 && (
                <p className="folder-empty">📭 В папке пока нет файлов</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}