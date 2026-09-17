"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  AlertCircle,
  Download,
  FileText,
  Image as ImageIcon,
  Link2,
  Presentation,
  Sparkles,
  StickyNote,
  Trash,
  Upload,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { shortDate } from "@/lib/date";
import type { Material, MaterialKind } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Segmented,
  Select,
  SubjectDot,
  Thinking,
  cx,
  useToast,
} from "@/components/ui";
import { useMaterialAI } from "@/components/app/use-ai";

const ICON: Record<MaterialKind, React.ElementType> = {
  pdf: FileText,
  ppt: Presentation,
  link: Link2,
  foto: ImageIcon,
  dok: StickyNote,
};

const AI_ACTIONS: { key: string; label: string }[] = [
  { key: "summarize", label: "Përmbledhe" },
  { key: "key-concepts", label: "Konceptet kryesore" },
  { key: "flashcards", label: "Krijo flashcards" },
  { key: "exam-questions", label: "Pyetje provimi" },
  { key: "explain", label: "Shpjego" },
];

export default function MaterialsPage() {
  const { state } = useStore();
  const [tab, setTab] = useState<"materiale" | "shenime">("materiale");
  const [uploading, setUploading] = useState(false);

  return (
    <div>
      <PageHeader
        title="Materialet"
        question="Çfarë kam për të mësuar dhe si ma shpjegon AI?"
        right={
          <>
            <Segmented
              value={tab}
              onChange={(v) => setTab(v as "materiale" | "shenime")}
              options={[
                { key: "materiale", label: "Materiale" },
                { key: "shenime", label: "Shënime" },
              ]}
            />
            <Button variant="primary" onClick={() => setUploading(true)}>
              <Upload size={14} />
              Ngarko
            </Button>
          </>
        }
      />

      {tab === "materiale" ? (
        state.materials.length === 0 ? (
          <EmptyState
            title="Nuk ke ende materiale"
            body="Ngarko një PDF ose shënime, dhe AI mund t'i përmbledhë, të krijojë kuize ose flashcards prej tyre."
            icon={<Upload size={22} />}
            action={
              <Button variant="primary" onClick={() => setUploading(true)}>
                <Upload size={14} />
                Ngarko materialin e parë
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {state.materials.map((m, i) => (
              <MaterialCard key={m.id} material={m} index={i} />
            ))}
          </div>
        )
      ) : (
        <NotesGrid />
      )}

      <UploadModal open={uploading} onClose={() => setUploading(false)} />
    </div>
  );
}

function MaterialCard({ material, index }: { material: Material; index: number }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const subject = state.subjects.find((s) => s.id === material.subjectId);
  const Icon = ICON[material.kind];
  const ai = useMaterialAI();

  return (
    <Card className={`anim-in anim-delay-${Math.min(index + 1, 5)}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-muted">
          <Icon size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-medium text-ink">{material.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-faint">
            {subject && (
              <span className="flex items-center gap-1.5">
                <SubjectDot toneIndex={subject.tone} size={6} />
                {subject.name}
              </span>
            )}
            <span>{material.meta}</span>
            <span>{shortDate(material.addedAt)}</span>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <a
            href={`/api/materials/${material.id}/file`}
            target="_blank"
            rel="noreferrer"
            aria-label="Hap skedarin"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <Download size={15} />
          </a>
          <button
            aria-label="Fshij"
            onClick={() => {
              dispatch({ type: "material/remove", id: material.id });
              toast("Materiali u fshi.");
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-bad"
          >
            <Trash size={15} />
          </button>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {AI_ACTIONS.map((a) => (
          <button
            key={a.key}
            disabled={!!ai.busy}
            onClick={() => ai.run(material.id, a.key, a.label)}
            className={cx(
              "rounded-full border px-2.5 py-1 text-[12px] transition-colors disabled:opacity-50",
              ai.busy === a.label
                ? "border-ai bg-ai-soft text-ai"
                : "border-line text-muted hover:border-ai hover:text-ai"
            )}
          >
            {a.label}
          </button>
        ))}
      </div>

      {ai.busy && (
        <div className="mt-3">
          <Thinking label={`AI po punon: ${ai.busy}…`} />
        </div>
      )}

      {ai.error && (
        <div className="anim-in mt-3 flex items-start gap-2 rounded-[10px] border border-bad/30 bg-bad-soft px-3 py-2.5">
          <AlertCircle size={13} className="mt-0.5 shrink-0 text-bad" />
          <p className="text-[12.5px] leading-relaxed text-bad">{ai.error}</p>
        </div>
      )}

      {ai.result && (
        <div className="anim-in mt-3 rounded-[10px] border border-ai/25 bg-ai-soft/35 p-3.5">
          <div className="flex items-center gap-1.5 text-ai">
            <Sparkles size={12} />
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.05em]">
              {ai.result.action}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
            {ai.result.text}
          </p>
        </div>
      )}

      {!ai.result && !ai.busy && material.summary && (
        <p className="mt-3 rounded-[10px] bg-sunken/60 p-3 text-[12.5px] leading-relaxed text-muted">
          {material.summary}
        </p>
      )}
    </Card>
  );
}

function NotesGrid() {
  const { state } = useStore();

  if (state.notes.length === 0) {
    return (
      <EmptyState
        title="Nuk ke ende shënime"
        body="Shënimet që ruan gjatë sesioneve të studimit shfaqen këtu."
        icon={<StickyNote size={22} />}
      />
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {state.notes.map((n) => {
        const subject = state.subjects.find((s) => s.id === n.subjectId);
        return (
          <Card key={n.id} hover>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[14.5px] font-medium text-ink">{n.title}</p>
              {n.pinned && <Badge tone="brand">Fiksuar</Badge>}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-muted">
              {n.body}
            </p>
            <div className="mt-3 flex items-center gap-2 text-[11.5px] text-faint">
              {subject && (
                <>
                  <SubjectDot toneIndex={subject.tone} size={6} />
                  {subject.name}
                </>
              )}
              <span className="num ml-auto">{shortDate(n.updatedAt)}</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function UploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useStore();
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    if (!file) {
      setError("Zgjedh një skedar.");
      return;
    }
    setBusy(true);
    setError(null);

    const form = new FormData();
    form.append("file", file);
    form.append("title", title || file.name);
    if (subjectId) form.append("subjectId", subjectId);

    try {
      const res = await fetch("/api/materials", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Ngarkimi dështoi.");
        return;
      }

      toast(
        data.hasText
          ? "Materiali u ngarkua dhe teksti u lexua."
          : "Materiali u ngarkua, por nuk u lexua tekst prej tij."
      );
      setFile(null);
      setTitle("");
      onClose();
      router.refresh();
    } catch {
      setError("Lidhja dështoi. Kontrollo internetin dhe provo përsëri.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ngarko material"
      footer={
        <>
          <Button onClick={onClose}>Anulo</Button>
          <Button variant="primary" onClick={upload} disabled={busy || !file}>
            {busy ? "Duke ngarkuar…" : "Ngarko"}
          </Button>
        </>
      }
    >
      <button
        onClick={() => inputRef.current?.click()}
        className={cx(
          "flex w-full flex-col items-center justify-center rounded-[12px] border border-dashed px-6 py-8 text-center transition-colors",
          file ? "border-brand bg-brand-soft/40" : "border-line hover:border-brand"
        )}
      >
        <Upload size={20} className={file ? "text-brand" : "text-faint"} />
        <p className="mt-2 text-[13.5px] font-medium text-ink">
          {file ? file.name : "Zgjedh një skedar"}
        </p>
        <p className="mt-1 text-[12.5px] text-muted">
          {file
            ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
            : "PDF, TXT ose DOCX · deri në 12 MB"}
        </p>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.md,.doc,.docx,application/pdf,text/plain,text/markdown"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setFile(f);
          if (f && !title) setTitle(f.name);
          setError(null);
        }}
      />

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-[10px] border border-bad/30 bg-bad-soft px-3 py-2.5">
          <AlertCircle size={13} className="mt-0.5 shrink-0 text-bad" />
          <p className="text-[12.5px] text-bad">{error}</p>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3.5">
        <Field label="Titulli">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="p.sh. Ligjërata 7 — Grafet"
          />
        </Field>
        <Field label="Lënda" hint="Opsionale">
          <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Pa lëndë</option>
            {state.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <p className="mt-4 text-[12px] leading-relaxed text-faint">
        Skedarët ruhen privatisht dhe janë të arritshëm vetëm nga llogaria jote.
      </p>
    </Modal>
  );
}
