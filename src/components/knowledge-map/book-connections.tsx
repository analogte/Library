"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Link2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BookConnection, ConnectedWord } from "@/lib/knowledge-graph";

interface BookConnectionsProps {
  connections: BookConnection[];
  mostConnectedWords: ConnectedWord[];
  isolatedBooks: { id: number; title: string }[];
}

export function BookConnections({
  connections,
  mostConnectedWords,
  isolatedBooks,
}: BookConnectionsProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      {/* Connections */}
      {connections.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">ความเชื่อมโยงระหว่างเล่ม</h3>
          {connections.map((conn, i) => (
            <Card key={i} className="p-4">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <BookOpen className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium truncate">{conn.bookA.title}</span>
                  <Link2 className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium truncate">{conn.bookB.title}</span>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <Badge variant="secondary" className="text-xs">
                    {conn.strength} คำร่วม
                  </Badge>
                  {expandedIndex === i ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              {expandedIndex === i && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
                  {conn.sharedWords.map((word) => (
                    <Badge key={word} variant="outline" className="text-xs">
                      {word}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Most connected words */}
      {mostConnectedWords.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">คำที่เชื่อมโยงมากสุด</h3>
          <div className="space-y-2">
            {mostConnectedWords.slice(0, 10).map((cw) => (
              <div key={cw.word} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{cw.word}</span>
                  <span className="text-xs text-muted-foreground">
                    {cw.bookTitles.join(", ")}
                  </span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {cw.count} เล่ม
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Isolated books */}
      {isolatedBooks.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
            หนังสือที่ยังไม่เชื่อมโยง
          </h3>
          <div className="flex flex-wrap gap-2">
            {isolatedBooks.map((book) => (
              <Badge key={book.id} variant="outline" className="text-xs">
                {book.title}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
