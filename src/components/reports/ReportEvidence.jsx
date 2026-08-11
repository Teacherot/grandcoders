import React from "react";
import { Image } from "@/components/ui/image";
import { Paperclip, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadUrl } from "@/lib/download";

export default function ReportEvidence({ url, label = "Evidence" }) {
  if (!url) return null;
  return (
    <div className="mt-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
        <Paperclip className="w-3 h-3" /> {label}
      </p>
      <div className="flex items-start gap-3">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block w-36 h-24 rounded-lg overflow-hidden border border-border bg-muted shrink-0"
        >
          <Image src={url} alt="Evidence" className="block w-36 h-24" fittingType="fill" />
        </a>
        <Button size="sm" variant="outline" onClick={() => downloadUrl(url, "evidence")}>
          <Download className="w-4 h-4" /> Download
        </Button>
      </div>
    </div>
  );
}