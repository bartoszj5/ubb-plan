import { useState, useEffect } from 'react';
import { fetchNotices, type Notice } from '../utils/api';
import { InfoIcon, ChevronRightIcon } from './Icons';
import './Notices.css';

export default function Notices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchNotices()
      .then(setNotices)
      .catch(() => {});
  }, []);

  if (notices.length === 0) return null;

  return (
    <div className="notices-section">
      <h3>
        <InfoIcon size={13} /> Uwagi
      </h3>
      <div className="notices-list">
        {notices.map((notice, i) => {
          const isExpanded = expandedIndex === i;
          return (
            <button
              key={i}
              className={`notice-item ${isExpanded ? 'expanded' : ''}`}
              onClick={() => setExpandedIndex(isExpanded ? null : i)}
            >
              <div className="notice-header">
                <ChevronRightIcon size={12} className="notice-chevron" />
                <span className="notice-title">{notice.title}</span>
              </div>
              {isExpanded && (
                <div className="notice-body">
                  {notice.description && (
                    <p className="notice-desc">{notice.description}</p>
                  )}
                  <ul>
                    {notice.items.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
