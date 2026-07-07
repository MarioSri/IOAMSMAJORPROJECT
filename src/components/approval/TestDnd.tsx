import React, { useState } from 'react';

export default function TestDnd() {
  const [items, setItems] = useState(['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5']);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newItems = [...items];
    const itemToMove = newItems[draggedIndex];
    newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, itemToMove);

    setItems(newItems);
    setDraggedIndex(null);
  };

  return (
    <div style={{ padding: 20 }}>
      <h3>Drag and Drop Test (Flex Wrap)</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 10, border: '1px solid #ccc' }}>
        {items.map((item, index) => (
          <div
            key={item}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={() => setDragOverIndex(null)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
            style={{
              padding: '5px 10px',
              backgroundColor: draggedIndex === index ? '#f0f0f0' : '#e0e0e0',
              border: dragOverIndex === index ? '2px dashed blue' : '1px solid #999',
              borderRadius: 4,
              cursor: 'grab',
              opacity: draggedIndex === index ? 0.5 : 1,
            }}
          >
            {index + 1}. {item}
          </div>
        ))}
      </div>
    </div>
  );
}
