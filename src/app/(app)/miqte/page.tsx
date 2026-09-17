"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Lock, Mail, UserPlus, Users, X } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Toggle,
  useToast,
} from "@/components/ui";

interface FriendRow {
  friendshipId: string;
  id: string;
  name: string;
  initials: string;
  tone: number;
  faculty: string;
  mutualSubjects: string[];
  streak: number;
  incoming: boolean;
}

export default function FriendsPage() {
  const { state, dispatch } = useStore();
  const toast = useToast();

  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [pending, setPending] = useState<FriendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/friends", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setFriends(data.friends as FriendRow[]);
      setPending(data.pending as FriendRow[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function respond(friendshipId: string, accept: boolean) {
    const res = await fetch("/api/friends", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendshipId, accept }),
    });
    if (res.ok) {
      toast(accept ? "Kërkesa u pranua." : "Kërkesa u refuzua.");
      load();
    }
  }

  const incoming = pending.filter((p) => p.incoming);
  const outgoing = pending.filter((p) => !p.incoming);

  return (
    <div>
      <PageHeader
        title="Miqtë"
        question="Me kë e ndaj rrugën e studimit?"
        right={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <UserPlus size={14} />
            Shto shok
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {incoming.length > 0 && (
            <Card padded={false}>
              <div className="px-5 pb-2 pt-4">
                <p className="text-[13px] font-medium text-ink">
                  Kërkesa për ty
                  <Badge className="ml-2">{incoming.length}</Badge>
                </p>
              </div>
              <div className="divide-y divide-line">
                {incoming.map((f) => (
                  <div key={f.friendshipId} className="flex items-center gap-3 px-5 py-3">
                    <Avatar initials={f.initials} toneIndex={f.tone} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-ink">
                        {f.name}
                      </span>
                      <span className="block truncate text-[12.5px] text-muted">{f.faculty}</span>
                    </span>
                    <Button size="sm" variant="primary" onClick={() => respond(f.friendshipId, true)}>
                      <Check size={13} />
                      Prano
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => respond(f.friendshipId, false)}>
                      <X size={13} />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {loading ? (
            <Card>
              <div className="skeleton h-4 w-40 rounded" />
              <div className="skeleton mt-3 h-4 w-64 rounded" />
            </Card>
          ) : friends.length === 0 ? (
            <EmptyState
              title="Nuk ke ende miq"
              body="Shto shokët e klasës me email-in e tyre. Pasi ta pranojnë, shihni lëndët e përbashkëta dhe mund të ftoni njëri-tjetrin në grupe studimi."
              icon={<Users size={22} />}
              action={
                <Button variant="primary" onClick={() => setAdding(true)}>
                  <UserPlus size={14} />
                  Shto shokun e parë
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {friends.map((f) => (
                <Card key={f.friendshipId}>
                  <div className="flex flex-wrap items-start gap-4">
                    <Avatar initials={f.initials} toneIndex={f.tone} size={42} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-ink">{f.name}</p>
                      {f.faculty && (
                        <p className="mt-0.5 text-[12.5px] text-muted">{f.faculty}</p>
                      )}
                      {f.mutualSubjects.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {f.mutualSubjects.map((m) => (
                            <Badge key={m}>{m}</Badge>
                          ))}
                        </div>
                      )}
                      <p className="mt-2.5 text-[12px] text-faint">
                        {f.mutualSubjects.length
                          ? `${f.mutualSubjects.length} lëndë të përbashkëta`
                          : "Pa lëndë të përbashkëta"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await fetch(`/api/friends?id=${f.friendshipId}`, { method: "DELETE" });
                        toast("U hoq nga lista e miqve.");
                        load();
                      }}
                    >
                      Hiq
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {outgoing.length > 0 && (
            <Card>
              <p className="text-[13px] font-medium text-ink">Kërkesa të dërguara</p>
              <div className="mt-3 flex flex-col gap-2">
                {outgoing.map((f) => (
                  <div key={f.friendshipId} className="flex items-center gap-3">
                    <Avatar initials={f.initials} toneIndex={f.tone} size={26} />
                    <span className="flex-1 truncate text-[13px] text-ink">{f.name}</span>
                    <Badge tone="warn">Në pritje</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <aside>
          <Card>
            <div className="flex items-center gap-2">
              <Lock size={14} className="text-muted" />
              <p className="text-[13px] font-medium text-ink">Privatësia</p>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
              Ti vendos çfarë shohin miqtë. Notat janë private si parazgjedhje.
            </p>
            <div className="mt-2 divide-y divide-line">
              <Toggle
                label="Statusi i mësimit"
                description="A je duke mësuar tani"
                checked={state.privacy.shareStatus}
                onChange={() => dispatch({ type: "privacy/toggle", key: "shareStatus" })}
              />
              <Toggle
                label="Orari"
                checked={state.privacy.shareSchedule}
                onChange={() => dispatch({ type: "privacy/toggle", key: "shareSchedule" })}
              />
              <Toggle
                label="Progresi"
                checked={state.privacy.shareProgress}
                onChange={() => dispatch({ type: "privacy/toggle", key: "shareProgress" })}
              />
              <Toggle
                label="Notat"
                description="Private si parazgjedhje"
                checked={state.privacy.shareGrades}
                onChange={() => dispatch({ type: "privacy/toggle", key: "shareGrades" })}
              />
            </div>
          </Card>
        </aside>
      </div>

      <AddFriend open={adding} onClose={() => setAdding(false)} onSent={load} />
    </div>
  );
}

function AddFriend({
  open,
  onClose,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Dërgimi dështoi.");
        return;
      }

      toast("Kërkesa u dërgua.");
      setEmail("");
      onClose();
      onSent();
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
      title="Shto shok"
      footer={
        <>
          <Button onClick={onClose}>Anulo</Button>
          <Button variant="primary" onClick={send} disabled={busy || !email.trim()}>
            {busy ? "Duke dërguar…" : "Dërgo kërkesën"}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-[13.5px] leading-relaxed text-muted">
        Shkruaj email-in me të cilin është regjistruar. Ai duhet ta pranojë kërkesën para se të
        shihni të dhënat e njëri-tjetrit.
      </p>

      {error && (
        <p className="mb-3 flex items-center gap-1.5 rounded-[9px] border border-bad/30 bg-bad-soft px-3 py-2 text-[12.5px] text-bad">
          <AlertCircle size={12} />
          {error}
        </p>
      )}

      <div className="relative">
        <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="shoku@shembull.com"
          className="pl-9"
          autoFocus
        />
      </div>
    </Modal>
  );
}
