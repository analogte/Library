"use client";

import { useState, useEffect } from "react";
import { Network, BookOpen, Languages } from "lucide-react";
import { buildKnowledgeGraph, type KnowledgeGraph } from "@/lib/knowledge-graph";
import { BookConnections } from "@/components/knowledge-map/book-connections";
import { Card, CardContent } from "@/components/ui/card";

export default function KnowledgeMapPage() {
  const [loading, setLoading] = useState(true);
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);

  useEffect(() => {
    buildKnowledgeGraph()
      .then(setGraph)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">กำลังวิเคราะห์...</p>
      </div>
    );
  }

  if (!graph || graph.totalBooks < 2 || graph.totalVocab === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <Network className="h-16 w-16 text-muted-foreground/50" />
        <div>
          <h3 className="text-lg font-medium">ยังไม่มีข้อมูลเพียงพอ</h3>
          <p className="text-sm text-muted-foreground">
            เพิ่มหนังสืออย่างน้อย 2 เล่ม และบันทึกคำศัพท์จากแต่ละเล่ม
            <br />
            เพื่อดูความเชื่อมโยง
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Network className="h-6 w-6" />
        แผนความรู้ข้ามเล่ม
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="py-3 gap-0">
          <CardContent className="flex items-center gap-3 px-4">
            <BookOpen className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">หนังสือ</p>
              <p className="text-sm font-semibold">{graph.totalBooks} เล่ม</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3 gap-0">
          <CardContent className="flex items-center gap-3 px-4">
            <Languages className="h-4 w-4 text-purple-500" />
            <div>
              <p className="text-xs text-muted-foreground">คำศัพท์</p>
              <p className="text-sm font-semibold">{graph.totalVocab} คำ</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3 gap-0">
          <CardContent className="flex items-center gap-3 px-4">
            <Network className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">เชื่อมโยง</p>
              <p className="text-sm font-semibold">{graph.connections.length} คู่</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <BookConnections
        connections={graph.connections}
        mostConnectedWords={graph.mostConnectedWords}
        isolatedBooks={graph.isolatedBooks}
      />
    </div>
  );
}
