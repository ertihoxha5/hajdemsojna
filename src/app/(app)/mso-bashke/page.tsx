"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Clock, Plus, Sparkles, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { dur, relativeDays } from "@/lib/date";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  SubjectDot,
  cx,
  useToast,
} from "@/components/ui";
import type { StudyGroup } from "@/lib/types";

export default function GroupsPage() {
  const { state, today } = useStore();
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  return (
    <div>
      <PageHeader
        title="Mso Bashkë"
        question="Me kë mund ta mësoj këtë?"
        right={
          <>
            <Button onClick={() => setJoining(true)}>Bashkohu me kod</Button>
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={14} />
              Krijo grup
            </Button>
          </>
        }
      />

      {state.groups.length === 0 ? (
        <EmptyState
          title="Nuk je ende në asnjë grup"
          body="Krijo një dhomë studimi për një lëndë, ose bashkohu me kodin e ftesës që të dha një shok."
          icon={<Users size={22} />}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Plus size={14} />
                Krijo grupin e parë
              </Button>
              <Button onClick={() => setJoining(true)}>Bashkohu me kod</Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {state.groups.map((g, i) => (
            <GroupCard key={g.id} group={g} index={i} today={today} />
          ))}
        </div>
      )}

      <CreateGroup open={creating} onClose={() => setCreating(false)} />
      <JoinGroup open={joining} onClose={() => setJoining(false)} />
    </div>
  );
}

function GroupCard({
  group,
  index,
  today,
}: {
  group: StudyGroup;
  index: number;
  today: string;
}) {
  const { state } = useStore();
  const subject = state.subjects.find((s) => s.id === group.subjectId);
  const people = group.members.filter((m) => m.role !== "ai");
  const online = people.filter((m) => m.state !== "offline").length;
  const live = group.nextSession?.date === today;

  return (
    <Card className={`anim-in anim-delay-${Math.min(index + 1, 5)}`} hover>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {subject && <SubjectDot toneIndex={subject.tone} />}
            <span className="text-[12.5px] text-muted">{subject?.name ?? "Grup studimi"}</span>
          </div>
          <h3 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-ink">
            {group.name}
          </h3>
          {group.about && (
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{group.about}</p>
          )}
        </div>
        {live && <Badge tone="ok">Sonte</Badge>}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex -space-x-2">
          {people.slice(0, 5).map((m) => (
            <Avatar
              key={m.id}
              initials={m.initials}
              toneIndex={m.tone}
              size={28}
              ring="var(--surface)"
            />
          ))}
        </div>
        <span className="text-[12.5px] text-muted">
          {people.length} {people.length === 1 ? "anëtar" : "anëtarë"}
          {online > 0 && <span className="text-ok"> · {online} online</span>}
        </span>
        {group.weeklyMinutes > 0 && (
          <span className="num ml-auto text-[12.5px] text-faint">
            {dur(group.weeklyMinutes)} këtë javë
          </span>
        )}
      </div>

      {group.nextSession && (
        <div
          className={cx(
            "mt-4 flex flex-wrap items-center gap-3 rounded-[10px] px-3.5 py-3",
            live ? "bg-brand-soft/60" : "bg-sunken/70"
          )}
        >
          <Clock size={14} className={live ? "text-brand" : "text-muted"} />
          <div className="min-w-0 flex-1">
            <p className="num text-[13px] font-medium text-ink">
              {relativeDays(today, group.nextSession.date)} · {group.nextSession.start}
              <span className="font-normal text-faint"> ({group.nextSession.minutes} min)</span>
            </p>
            <p className="truncate text-[12.5px] text-muted">{group.nextSession.topic}</p>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Link href={`/mso-bashke/${group.id}`}>
          <Button size="sm" variant={live ? "primary" : "secondary"}>
            {live ? "Hyr në dhomë" : "Hap grupin"}
          </Button>
        </Link>
        <span className="ml-auto flex items-center gap-1.5 text-[12px] text-ai">
          <Sparkles size={12} />
          Asistenti AI është në dhomë
        </span>
      </div>
    </Card>
  );
}

function CreateGroup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useStore();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) {
      setError("Shkruaj emrin e grupit.");
      return;
    }
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), about, subjectId: subjectId || null }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Krijimi dështoi.");
        return;
      }

      toast(`Grupi u krijua. Kodi i ftesës: ${data.inviteCode}`);
      setName("");
      setAbout("");
      onClose();
      router.push(`/mso-bashke/${data.id}`);
      router.refresh();
    } catch {
      setError("Lidhja dështoi. Provo përsëri.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Krijo grup studimi"
      footer={
        <>
          <Button onClick={onClose}>Anulo</Button>
          <Button variant="primary" onClick={create} disabled={busy}>
            {busy ? "Duke krijuar…" : "Krijo"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        {error && (
          <p className="rounded-[9px] border border-bad/30 bg-bad-soft px-3 py-2 text-[12.5px] text-bad">
            {error}
          </p>
        )}
        <Field label="Emri i grupit">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="p.sh. Algoritme Crew"
            autoFocus
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
        <Field label="Përshkrimi" hint="Opsionale">
          <Input
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="Për çfarë do të përdoret ky grup?"
          />
        </Field>
        <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ai">
          <Sparkles size={13} className="mt-0.5 shrink-0" />
          Pas krijimit merr një kod ftese për shokët. Asistenti AI është pjesë e çdo dhome.
        </p>
      </div>
    </Modal>
  );
}

function JoinGroup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    if (code.trim().length < 4) {
      setError("Shkruaj kodin e ftesës.");
      return;
    }
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Bashkimi dështoi.");
        return;
      }

      toast("U bashkove në grup.");
      setCode("");
      onClose();
      router.push(`/mso-bashke/${data.id}`);
      router.refresh();
    } catch {
      setError("Lidhja dështoi. Provo përsëri.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bashkohu me kod"
      footer={
        <>
          <Button onClick={onClose}>Anulo</Button>
          <Button variant="primary" onClick={join} disabled={busy}>
            {busy ? "Duke u bashkuar…" : "Bashkohu"}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-[13.5px] text-muted">Fut kodin që të dha anëtari i grupit.</p>
      {error && (
        <p className="mb-3 rounded-[9px] border border-bad/30 bg-bad-soft px-3 py-2 text-[12.5px] text-bad">
          {error}
        </p>
      )}
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="p.sh. K7MQP2"
        autoFocus
        className="num text-center text-[18px] font-semibold tracking-[0.2em]"
      />
    </Modal>
  );
}
