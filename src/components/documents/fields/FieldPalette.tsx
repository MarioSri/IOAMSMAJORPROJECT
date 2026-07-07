/**
 * FieldPalette
 * Drag-and-drop field type picker (right-hand panel).
 * Inspired by Documenso's field placement system (internal implementation).
 *
 * Full suite: Signature → Stamp → Initials → Name → Company → Job Title →
 *             Date → Text → Number → Phone → Email → Checkbox → Radio →
 *             Dropdown → Image
 */
import React from 'react';
import {
  PenTool,
  Stamp,
  Type,
  Building2,
  Briefcase,
  Calendar,
  AlignLeft,
  CheckSquare,
  Mail,
  ImageIcon,
  Hash,
  Phone,
  Circle,
  ChevronDown,
  User,
} from 'lucide-react';

interface FieldType {
  type: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const FIELD_TYPES: FieldType[] = [
  { type: 'stamp', label: 'Stamp', icon: <Stamp className="w-4 h-4" />, color: 'bg-purple-500' },
  { type: 'initials', label: 'Initials', icon: <Type className="w-4 h-4" />, color: 'bg-teal-500' },
  { type: 'name', label: 'Name', icon: <User className="w-4 h-4" />, color: 'bg-blue-500' },
  { type: 'company', label: 'Company', icon: <Building2 className="w-4 h-4" />, color: 'bg-orange-500' },
  { type: 'job_title', label: 'Job Title', icon: <Briefcase className="w-4 h-4" />, color: 'bg-pink-500' },
  { type: 'date', label: 'Date', icon: <Calendar className="w-4 h-4" />, color: 'bg-yellow-500' },
  { type: 'text', label: 'Text', icon: <AlignLeft className="w-4 h-4" />, color: 'bg-gray-500' },
  { type: 'number', label: 'Number', icon: <Hash className="w-4 h-4" />, color: 'bg-emerald-500' },
  { type: 'phone', label: 'Phone', icon: <Phone className="w-4 h-4" />, color: 'bg-violet-500' },
  { type: 'email', label: 'Email', icon: <Mail className="w-4 h-4" />, color: 'bg-red-500' },
  { type: 'checkbox', label: 'Checkbox', icon: <CheckSquare className="w-4 h-4" />, color: 'bg-indigo-500' },
  { type: 'radio', label: 'Radio', icon: <Circle className="w-4 h-4" />, color: 'bg-sky-500' },
  { type: 'dropdown', label: 'Dropdown', icon: <ChevronDown className="w-4 h-4" />, color: 'bg-amber-600' },
  { type: 'image', label: 'Image', icon: <ImageIcon className="w-4 h-4" />, color: 'bg-cyan-500' },
];

interface FieldPaletteProps {
  onDragStart: (e: React.DragEvent, fieldType: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  selectedRole?: string | null;
  className?: string;
}

export const FieldPalette: React.FC<FieldPaletteProps> = ({
  onDragStart,
  onDragEnd,
  selectedRole,
  className = '',
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Field Types</h4>
        {selectedRole && selectedRole !== 'None' && (
          <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold truncate max-w-[120px]">
            {selectedRole}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 gap-1.5 sm:gap-2">
        {FIELD_TYPES.map((field) => (
          <div
            key={field.type}
            draggable
            onDragStart={(e) => onDragStart(e, field.type)}
            onDragEnd={(e) => onDragEnd && onDragEnd(e)}
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl bg-white border border-gray-100 shadow-sm cursor-grab hover:shadow-md hover:border-blue-200 hover:-translate-y-0.5 active:cursor-grabbing active:scale-[0.97] transition-all select-none group"
          >
            <span
              className={`flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center text-white ${field.color} shadow-sm group-hover:shadow-md transition-shadow`}
            >
              {field.icon}
            </span>
            <span className="text-[10px] sm:text-xs font-semibold text-gray-700 truncate">{field.label}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-gray-400 text-center pt-1">
        Drag fields onto the document
      </p>
    </div>
  );
};

export default FieldPalette;
