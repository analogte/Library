"use client";

import { useRouter } from "next/navigation";
import { FileText, BookOpen, MoreVertical, Trash2, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { Book } from "@/lib/types";
import { formatFileSize } from "@/lib/book-utils";

const STATUS_LABELS: Record<string, string> = {
  unread: "ยังไม่อ่าน",
  reading: "กำลังอ่าน",
  finished: "อ่านจบแล้ว",
};

interface BookCardProps {
  book: Book;
  progress?: number;
  onDelete?: (id: number) => void;
  onStatusChange?: (id: number, status: Book["status"]) => void;
}

export function BookCard({ book, progress, onDelete, onStatusChange }: BookCardProps) {
  const router = useRouter();

  return (
    <Card
      className="group relative cursor-pointer overflow-hidden transition-shadow hover:shadow-lg"
      onClick={(e) => {
        // Don't navigate if clicking dropdown menu
        const target = e.target as HTMLElement;
        if (target.closest("button") || target.closest("[role='menu']")) return;
        router.push(`/reader/${book.id}`);
      }}
    >
      <div className="block">
        {/* Cover */}
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
          {book.coverImage ? (
            <img
              src={book.coverImage}
              alt={book.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-muted-foreground">
              <FileText className="h-12 w-12" />
              <span className="text-center text-xs leading-tight line-clamp-3">
                {book.title}
              </span>
            </div>
          )}

          {/* Format badge */}
          <Badge
            variant="secondary"
            className="absolute right-2 top-2 text-[10px] uppercase"
          >
            {book.format}
          </Badge>

          {/* Progress bar */}
          {book.status === "reading" && progress !== undefined && progress > 0 && (
            <div className="absolute inset-x-0 bottom-0">
              <Progress value={progress} className="h-1 rounded-none" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          <h3 className="text-sm font-medium leading-tight line-clamp-2">
            {book.title}
          </h3>
          {book.author && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
              {book.author}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {STATUS_LABELS[book.status]}
            </Badge>
            {book.fileSize && (
              <span className="text-[10px] text-muted-foreground">
                {formatFileSize(book.fileSize)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1 h-7 w-7 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(`/notes/${book.id}`)}>
            <FileText className="mr-2 h-4 w-4" />
            บันทึก
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onStatusChange?.(book.id!, "reading")}>
            <BookOpen className="mr-2 h-4 w-4" />
            กำลังอ่าน
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onStatusChange?.(book.id!, "finished")}>
            <CheckCircle className="mr-2 h-4 w-4" />
            อ่านจบแล้ว
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => onDelete?.(book.id!)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            ลบหนังสือ
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
}
