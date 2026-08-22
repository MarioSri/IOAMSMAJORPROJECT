/**
 * FieldOverlay
 * Single reusable component for all signature/field overlays on any document type.
 * Replaces ~500 lines of copy-pasted JSX across PDF/Image/Word renderers.
 *
 * Architecture inspired by Documenso's field-placement system.
 * Implementation is fully internal — no external APIs.
 *
 * Supports: signature, stamp, initials, name, company, job_title,
 *           date, text, number, phone, email, checkbox, radio, dropdown, image
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, X, Move, CheckCircle2, Circle } from 'lucide-react';
import type { SignatureMetadata } from '../signature/useSignatureEngine';

interface FieldOverlayProps {
  signature: SignatureMetadata;
  isSelected: boolean;
  canEdit: boolean;
  currentUser: string;
  isDragging?: boolean;
  isResizing?: boolean;
  onSelect: (id: string) => void;
  onMouseDown: (e: React.PointerEvent, id: string) => void;
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
  onResizeMouseDown: (e: React.PointerEvent, id: string, corner: 'tl' | 'tr' | 'bl' | 'br') => void;
  onFieldDataChange?: (id: string, value: string) => void;
}

const FIELD_LABEL_MAP: Record<string, string> = {
  job_title: 'JOB TITLE',
  image: 'IMAGE UPLOAD',
  signature: 'SIGNATURE',
  stamp: 'STAMP',
  initials: 'INITIALS',
  name: 'NAME',
  company: 'COMPANY',
  date: 'DATE',
  text: 'TEXT',
  number: 'NUMBER',
  phone: 'PHONE',
  checkbox: 'CHECKBOX',
  radio: 'RADIO',
  dropdown: 'DROPDOWN',
  email: 'EMAIL',
};

/** Default dropdown options — users configure via field settings */
const DEFAULT_DROPDOWN_OPTIONS = ['Option 1', 'Option 2', 'Option 3'];


const FieldContent: React.FC<{
  signature: SignatureMetadata;
  onChange?: (id: string, value: string) => void;
}> = ({ signature, onChange }) => {
  const { type, data, id } = signature;
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // ── Image-based fields (signature, stamp, initials, image) ─────────────
  const isImageType = !type || ['signature', 'stamp', 'initials', 'image'].includes(type);
  if (isImageType) {
    if (!data) {
      // Empty placeholder for signatures
      return (
        <div className="w-full h-full border-2 border-blue-200/60 bg-blue-50/40 shadow-sm flex flex-col items-center justify-center pointer-events-none rounded-sm">
          <span className="text-blue-700/60 font-bold text-[8px] sm:text-[10px] md:text-xs text-center leading-tight uppercase px-2 tracking-wider">
            {FIELD_LABEL_MAP[type ?? ''] ?? type ?? 'Signature'}
          </span>
        </div>
      );
    }
    return (
      <img
        src={data}
        className="w-full h-full object-contain pointer-events-none rounded-sm"
        draggable={false}
        alt={type ?? 'Signature'}
      />
    );
  }

  // ── Checkbox ──────────────────────────────────────────────────────────────
  if (type === 'checkbox') {
    return (
      <div
        className="w-full h-full flex items-center justify-center bg-blue-50/80 border border-blue-200/60 rounded-sm cursor-pointer hover:bg-blue-100/80 transition-colors"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onChange?.(id, data === 'true' ? 'false' : 'true');
        }}
        title="Toggle Checkbox"
      >
        <CheckCircle2
          className={`w-[70%] h-[70%] ${data === 'true' ? 'text-blue-600' : 'text-gray-300'}`}
        />
      </div>
    );
  }

  // ── Radio ─────────────────────────────────────────────────────────────────
  if (type === 'radio') {
    return (
      <div
        className="w-full h-full flex items-center justify-center bg-sky-50/80 border border-sky-200/60 rounded-sm cursor-pointer hover:bg-sky-100/80 transition-colors"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onChange?.(id, data === 'true' ? 'false' : 'true');
        }}
        title="Toggle Radio"
      >
        <Circle
          className={`w-[60%] h-[60%] ${data === 'true' ? 'text-sky-600 fill-sky-600' : 'text-gray-300'}`}
        />
      </div>
    );
  }

  // ── Dropdown ──────────────────────────────────────────────────────────────
  if (type === 'dropdown') {
    const options = (signature as unknown as Record<string, unknown>).dropdownOptions as string[] | undefined
      ?? DEFAULT_DROPDOWN_OPTIONS;

    return (
      <div
        className="w-full h-full flex items-center justify-center p-1 overflow-visible relative bg-amber-50/80 border border-amber-200/60 rounded-sm"
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          className="w-full h-full text-[10px] sm:text-xs text-center font-medium text-blue-900 bg-transparent rounded cursor-pointer hover:bg-amber-100/50 transition-colors flex items-center justify-between px-1.5 outline-none"
          onClick={(e) => {
            e.stopPropagation();
            setDropdownOpen(!dropdownOpen);
          }}
          title="Select Option"
        >
          <span className="truncate">{data || 'Select…'}</span>
          <span className="text-[8px] ml-1">▼</span>
        </button>
        {dropdownOpen && (
          <div
            className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded shadow-lg z-[200] max-h-[120px] overflow-y-auto"
            onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
          >
            {options.map((opt) => (
              <button
                key={opt}
                className="w-full text-left px-2 py-1.5 text-[10px] sm:text-xs hover:bg-blue-50 transition-colors truncate"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange?.(id, opt);
                  setDropdownOpen(false);
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Text-based fields (name, job_title, company, date, text, number, phone, email) ─
  const inputType = (() => {
    switch (type) {
      case 'date': return 'date';
      case 'email': return 'email';
      case 'number': return 'number';
      case 'phone': return 'tel';
      default: return 'text';
    }
  })();

  return (
    <div className="w-full h-full flex items-center justify-center p-1 overflow-hidden bg-emerald-50/80 border border-emerald-200/60 rounded-sm">
      <input
        type={inputType}
        value={data || ''}
        onChange={(e) => onChange?.(id, e.target.value)}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        placeholder={FIELD_LABEL_MAP[type] ?? type}
        title={FIELD_LABEL_MAP[type] ?? type}
        className="w-full h-full text-[10px] sm:text-xs text-center font-medium text-emerald-900 bg-transparent border-none outline-none placeholder:text-emerald-700/50 placeholder:text-[9px] placeholder:uppercase placeholder:tracking-wider placeholder:font-bold"
      />
    </div>
  );
};

export const FieldOverlay: React.FC<FieldOverlayProps> = ({
  signature,
  isSelected,
  canEdit,
  currentUser,
  isDragging = false,
  isResizing = false,
  onSelect,
  onMouseDown,
  onRotate,
  onDelete,
  onResizeMouseDown,
  onFieldDataChange,
}) => {
  const isOwn = !signature.signedBy || signature.signedBy === currentUser;
  const location = signature.location ?? {
    fileIndex: signature.fileIndex ?? 0,
    pageNumber: signature.pageNumber ?? 1,
    xPercent: signature.xPercent,
    yPercent: signature.yPercent,
    widthPercent: signature.widthPercent,
    heightPercent: signature.heightPercent,
  };
  const locationLabel = `File ${location.fileIndex + 1}, page ${location.pageNumber}, x ${(location.xPercent * 100).toFixed(2)}%, y ${(location.yPercent * 100).toFixed(2)}%, width ${(location.widthPercent * 100).toFixed(2)}%, height ${(location.heightPercent * 100).toFixed(2)}%`;

  return (
    <div
      data-signature-id={signature.id}
      data-signed-location={`${location.fileIndex}:${location.pageNumber}:${location.xPercent}:${location.yPercent}:${location.widthPercent}:${location.heightPercent}`}
      aria-label={`${FIELD_LABEL_MAP[signature.type ?? ''] ?? signature.type ?? 'Signature'} at ${locationLabel}`}
      className={[
        'absolute select-none cursor-pointer flex flex-col items-center',
        isSelected && (isDragging || isResizing) ? 'transition-none' : 'transition-all duration-200',
        isSelected
          ? 'ring-2 ring-blue-400/60 shadow-lg border-2 border-blue-500 rounded-sm bg-white/50'
          : 'border border-transparent hover:border-blue-300/50 hover:shadow-sm rounded-sm',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        left: `${signature.xPercent * 100}%`,
        top: `${signature.yPercent * 100}%`,
        width: `${signature.widthPercent * 100}%`,
        height: `${signature.heightPercent * 100}%`,
        transform: `rotate(${signature.rotation}deg)`,
        transformOrigin: 'center',
        zIndex: isSelected ? 100 : 50,
        pointerEvents: 'auto',
        touchAction: 'none',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(signature.id);
      }}
      onPointerDown={(e) => onMouseDown(e, signature.id)}
    >
      <div className="flex-1 flex items-center justify-center overflow-hidden w-full h-full min-h-0">
        <FieldContent signature={signature} onChange={onFieldDataChange} />
      </div>

      {/* Signer inner badge — Moved inside the box */}
      {signature.signedBy && (!isOwn || (isOwn && signature.assignedRole)) && (
        <div className="flex-shrink-0 flex justify-center pb-1 pointer-events-none">
          <Badge
            variant={isOwn ? 'default' : 'secondary'}
            className={[
              'text-[7px] sm:text-[9px] px-1 py-0 border-none shadow-none truncate max-w-[95%] leading-tight bg-transparent',
              isOwn ? 'text-blue-600 font-bold' : 'text-gray-500 font-medium'
            ].join(' ')}
          >
            {signature.assignedRole || (isOwn ? '' : signature.signedBy)}
          </Badge>
        </div>
      )}

      {/* Control bar — rotate, delete, drag handle */}
      {isSelected && canEdit && (
        <div className="absolute -top-8 sm:-top-9 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-white/95 backdrop-blur-sm rounded-lg border border-blue-500 p-0.5 sm:p-1 w-max shadow-md z-[120]">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onRotate(signature.id);
            }}
            className="h-6 w-6 sm:h-7 sm:w-7 p-0 hover:bg-blue-50 text-blue-600"
            title="Rotate 90°"
          >
            <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(signature.id);
            }}
            className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
            title="Delete"
          >
            <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </Button>
          <div
            className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 text-gray-400 cursor-move hover:text-gray-600"
            title="Drag to reposition"
            onPointerDown={(e) => onMouseDown(e, signature.id)}
          >
            <Move className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </div>
        </div>
      )}

      {/* Resize handles */}
      {isSelected && canEdit && (
        <>
          <div
            className="absolute -top-1 -left-1 sm:-top-1.5 sm:-left-1.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-500 rounded-full cursor-nwse-resize hover:scale-125 transition-transform border-2 border-white shadow-sm z-50"
            onPointerDown={(e) => onResizeMouseDown(e, signature.id, 'tl')}
          />
          <div
            className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-500 rounded-full cursor-nesw-resize hover:scale-125 transition-transform border-2 border-white shadow-sm z-50"
            onPointerDown={(e) => onResizeMouseDown(e, signature.id, 'tr')}
          />
          <div
            className="absolute -bottom-1 -left-1 sm:-bottom-1.5 sm:-left-1.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-500 rounded-full cursor-nesw-resize hover:scale-125 transition-transform border-2 border-white shadow-sm z-50"
            onPointerDown={(e) => onResizeMouseDown(e, signature.id, 'bl')}
          />
          <div
            className="absolute -bottom-1 -right-1 sm:-bottom-1.5 sm:-right-1.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-500 rounded-full cursor-nwse-resize hover:scale-125 transition-transform border-2 border-white shadow-sm z-50"
            onPointerDown={(e) => onResizeMouseDown(e, signature.id, 'br')}
          />
        </>
      )}
    </div>
  );
};

export default FieldOverlay;
