import { useState } from "react";
import { ResponsiveLayout } from "@/components/layout/ResponsiveLayout";
import { DocumentTracker } from "@/components/documents/DocumentTracker";
import { FileViewer } from "@/components/documents/FileViewer";
import { useAuth } from "@/contexts/AuthContext";

export default function TrackDocuments() {
  const { user } = useAuth();
  const [viewingFile, setViewingFile] = useState<File | null>(null);

  const [viewingFiles, setViewingFiles] = useState<File[]>([]);
  const [showFileViewer, setShowFileViewer] = useState(false);

  const handleViewFile = (file: File) => {
    setViewingFile(file);
    setViewingFiles([]);
    setShowFileViewer(true);
  };

  const handleViewFiles = (files: File[]) => {
    setViewingFiles(files);
    setViewingFile(null);
    setShowFileViewer(true);
  };

  if (!user) return null;

  return (
    <ResponsiveLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Track Documents</h1>
            <p className="text-muted-foreground">Monitor The Status And Progress Of Your Submitted Documents.</p>
          </div>
        </div>

        <div className="space-y-6">
          <DocumentTracker
            userRole={user.role}
            userName={user.name}
            onViewFile={handleViewFile}
            onViewFiles={handleViewFiles}
          />
        </div>
      </div>

      <FileViewer
        file={viewingFile}
        files={viewingFiles.length > 0 ? viewingFiles : undefined}
        open={showFileViewer}
        onOpenChange={setShowFileViewer}
      />
    </ResponsiveLayout>
  );
}
