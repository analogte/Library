"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  Settings,
  Moon,
  Sun,
  Monitor,
  Download,
  Upload,
  HardDrive,
  Trash2,
  Languages,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import { toast } from "sonner";
import {
  getTranslateEngine,
  setTranslateEngine,
  type TranslateEngine,
} from "@/lib/translate";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [storageUsage, setStorageUsage] = useState<string>("");
  const [bookCount, setBookCount] = useState(0);
  const [vocabCount, setVocabCount] = useState(0);
  const [translateEngine, setTranslateEngineState] = useState<TranslateEngine>("google");

  useEffect(() => {
    (async () => {
      setBookCount(await db.books.count());
      setVocabCount(await db.vocabulary.count());
      setTranslateEngineState(await getTranslateEngine());
      if (navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        const used = est.usage ?? 0;
        const quota = est.quota ?? 0;
        setStorageUsage(
          `${(used / (1024 * 1024)).toFixed(1)} MB / ${(quota / (1024 * 1024 * 1024)).toFixed(1)} GB`
        );
      }
    })();
  }, []);

  const handleEngineChange = async (engine: TranslateEngine) => {
    await setTranslateEngine(engine);
    setTranslateEngineState(engine);
    toast.success(engine === "gemini" ? "เปลี่ยนเป็น AI (Gemini)" : "เปลี่ยนเป็น Google Translate");
  };

  const handleExport = async () => {
    try {
      const data = {
        exportDate: new Date().toISOString(),
        version: 1,
        books: await db.books.toArray(),
        readingProgress: await db.readingProgress.toArray(),
        bookmarks: await db.bookmarks.toArray(),
        highlights: await db.highlights.toArray(),
        vocabulary: await db.vocabulary.toArray(),
        appSettings: await db.appSettings.toArray(),
      };
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `library-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("ส่งออกข้อมูลสำเร็จ");
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("ส่งออกข้อมูลล้มเหลว");
    }
  };

  const handleImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (
          !data.version ||
          !Array.isArray(data.books) ||
          (data.readingProgress && !Array.isArray(data.readingProgress)) ||
          (data.bookmarks && !Array.isArray(data.bookmarks)) ||
          (data.highlights && !Array.isArray(data.highlights)) ||
          (data.vocabulary && !Array.isArray(data.vocabulary))
        ) {
          toast.error("ไฟล์ backup ไม่ถูกต้อง — รูปแบบข้อมูลไม่ตรงกัน");
          return;
        }

        await db.transaction(
          "rw",
          [
            db.books,
            db.readingProgress,
            db.bookmarks,
            db.highlights,
            db.vocabulary,
            db.appSettings,
          ],
          async () => {
            if (data.books?.length) await db.books.bulkPut(data.books);
            if (data.readingProgress?.length)
              await db.readingProgress.bulkPut(data.readingProgress);
            if (data.bookmarks?.length)
              await db.bookmarks.bulkPut(data.bookmarks);
            if (data.highlights?.length)
              await db.highlights.bulkPut(data.highlights);
            if (data.vocabulary?.length)
              await db.vocabulary.bulkPut(data.vocabulary);
            if (data.appSettings?.length)
              await db.appSettings.bulkPut(data.appSettings);
          }
        );
        toast.success("นำเข้าข้อมูลสำเร็จ");
        window.location.reload();
      } catch (err) {
        console.error("Import failed:", err);
        toast.error(
          err instanceof SyntaxError
            ? "ไฟล์ JSON ไม่ถูกต้อง"
            : "นำเข้าข้อมูลล้มเหลว"
        );
      }
    };
    input.click();
  };

  const handleClearAll = async () => {
    if (!confirm("ลบข้อมูลทั้งหมด? การกระทำนี้ไม่สามารถย้อนกลับได้")) return;
    await db.delete();
    toast.success("ลบข้อมูลทั้งหมดแล้ว");
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Settings className="h-6 w-6" />
        ตั้งค่า
      </h1>

      {/* Theme */}
      <Card className="p-4">
        <h2 className="mb-3 font-semibold">ธีม</h2>
        <div className="flex gap-2">
          {[
            { value: "light", label: "สว่าง", icon: Sun },
            { value: "dark", label: "มืด", icon: Moon },
            { value: "system", label: "ตามระบบ", icon: Monitor },
          ].map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              variant={theme === value ? "default" : "outline"}
              onClick={() => setTheme(value)}
              className="flex-1"
            >
              <Icon className="mr-2 h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>
      </Card>

      {/* Translation engine */}
      <Card className="p-4">
        <h2 className="mb-1 flex items-center gap-2 font-semibold">
          <Languages className="h-4 w-4" />
          เครื่องมือแปลภาษา
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          เลือกระหว่าง Google Translate (เร็ว, ฟรี) หรือ AI Gemini (แปลตามบริบท, แม่นยำกว่า)
        </p>
        <div className="flex gap-2">
          <Button
            variant={translateEngine === "google" ? "default" : "outline"}
            onClick={() => handleEngineChange("google")}
            className="flex-1"
          >
            <Languages className="mr-2 h-4 w-4" />
            Google Translate
          </Button>
          <Button
            variant={translateEngine === "gemini" ? "default" : "outline"}
            onClick={() => handleEngineChange("gemini")}
            className="flex-1"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            AI (Gemini)
          </Button>
        </div>
      </Card>

      {/* Storage info */}
      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <HardDrive className="h-4 w-4" />
          พื้นที่จัดเก็บ
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">หนังสือ</span>
            <span>{bookCount} เล่ม</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">คำศัพท์</span>
            <span>{vocabCount} คำ</span>
          </div>
          {storageUsage && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">พื้นที่ที่ใช้</span>
              <span>{storageUsage}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Backup */}
      <Card className="p-4">
        <h2 className="mb-3 font-semibold">สำรองข้อมูล</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          ส่งออก/นำเข้าข้อมูลคำศัพท์ บุ๊กมาร์ก ไฮไลท์ และความก้าวหน้าการอ่าน
          (ไม่รวมไฟล์หนังสือ)
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} className="flex-1">
            <Download className="mr-2 h-4 w-4" />
            ส่งออก JSON
          </Button>
          <Button variant="outline" onClick={handleImport} className="flex-1">
            <Upload className="mr-2 h-4 w-4" />
            นำเข้า JSON
          </Button>
        </div>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/50 p-4">
        <h2 className="mb-3 font-semibold text-destructive">โซนอันตราย</h2>
        <Button variant="destructive" onClick={handleClearAll}>
          <Trash2 className="mr-2 h-4 w-4" />
          ลบข้อมูลทั้งหมด
        </Button>
      </Card>
    </div>
  );
}
