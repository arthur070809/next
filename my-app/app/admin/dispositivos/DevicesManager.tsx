"use client";

import { useState } from "react";
import { PageHeader, StatusBadge } from "@/app/components/industrial";
import { EmptyState } from "@/app/components/ui";

type Employee = { id: number; nome: string; cracha: string };
type Device = {
  id: string;
  nome: string;
  criadoEm: string | Date;
  pareadoEm: string | Date | null;
  ultimoAcessoEm: string | Date | null;
  revogadoEm: string | Date | null;
  credenciais: Array<{ id: string; criadoEm: string | Date; consentVersion: string; funcionario: Employee }>;
};
type PairCode = { deviceName: string; code: string; expiresAt: string };

const dateLabel = (value: string | Date | null) => value ? new Date(value).toLocaleString("pt-BR") : "Nunca";

export default function DevicesManager({ initialDevices, employees, limit }: { initialDevices: Device[]; employees: Employee[]; limit: number }) {
  const [devices, setDevices] = useState(initialDevices);
  const [name, setName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [pairCode, setPairCode] = useState<PairCode | null>(null);
  const [emergencyDeviceId, setEmergencyDeviceId] = useState("");
  const [emergencyUserId, setEmergencyUserId] = useState("");
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function createDevice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, funcionarioId: Number(employeeId) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível cadastrar o aparelho.");
      setDevices((current) => [{ ...data.device, criadoEm: new Date().toISOString(), pareadoEm: null, ultimoAcessoEm: null, revogadoEm: null, credenciais: [] }, ...current]);
      setPairCode({ deviceName: data.device.nome, code: data.pairingCode, expiresAt: data.expiresAt });
      setName("");
      setEmployeeId("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível cadastrar o aparelho.");
    } finally {
      setBusy(false);
    }
  }

  async function createPairing(device: Device) {
    const targetEmployee = device.credenciais[0]?.funcionario ?? employees[0];
    if (!targetEmployee) { setError("Cadastre primeiro um funcionário ativo."); return; }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/devices/${encodeURIComponent(device.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pair", funcionarioId: targetEmployee.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível criar um novo código.");
      setPairCode({ deviceName: device.nome, code: data.pairingCode, expiresAt: data.expiresAt });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar um novo código.");
    } finally {
      setBusy(false);
    }
  }

  async function revokeDevice(device: Device) {
    if (busy || !window.confirm(`Revogar ${device.nome}? O aparelho perderá acesso e as sessões vinculadas serão encerradas.`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/devices/${encodeURIComponent(device.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "revoke" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível revogar o aparelho.");
      const now = new Date().toISOString();
      setDevices((current) => current.map((row) => row.id === device.id ? { ...row, revogadoEm: now } : row));
      setMessage("Aparelho revogado. As sessões vinculadas foram encerradas.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível revogar o aparelho.");
    } finally {
      setBusy(false);
    }
  }

  async function removeCredential(device: Device, credentialId: string, employeeName: string) {
    if (busy || !window.confirm(`Remover a verificação local de ${employeeName} neste aparelho?`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/credentials/${encodeURIComponent(credentialId)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível remover o autenticador.");
      setDevices((current) => current.map((row) => row.id === device.id ? { ...row, credenciais: row.credenciais.filter((credential) => credential.id !== credentialId) } : row));
      setMessage(data.message ?? "Autenticador removido.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível remover o autenticador.");
    } finally {
      setBusy(false);
    }
  }

  async function grantEmergencyAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !emergencyDeviceId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/devices/${encodeURIComponent(emergencyDeviceId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "emergency-access", funcionarioId: Number(emergencyUserId), justification }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível liberar o acesso emergencial.");
      setMessage(`Acesso de emergência aprovado até ${new Date(data.expiresAt).toLocaleString("pt-BR")}. Uso único, auditado.`);
      setEmergencyUserId("");
      setEmergencyDeviceId("");
      setJustification("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível liberar o acesso emergencial.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="mx-auto max-w-7xl p-4 sm:p-6">
    <PageHeader eyebrow="Segurança de acesso" title="Aparelhos aprovados" description={`${devices.filter((device) => !device.revogadoEm).length} de ${limit} aparelhos ativos.`} />
    {error && <p role="alert" className="mt-4 rounded-control bg-error-surface p-3 text-sm text-error">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-control bg-success-surface p-3 text-sm text-success">{message}</p>}
    {pairCode && <section aria-label="Código de pareamento" className="mt-5 rounded-card bg-success-surface p-4 shadow-card"><h2 className="font-semibold text-success">Código de pareamento · {pairCode.deviceName}</h2><p className="mt-2 font-mono text-2xl font-bold tracking-widest text-success">{pairCode.code}</p><p className="mt-1 text-sm text-success">Expira {new Date(pairCode.expiresAt).toLocaleTimeString("pt-BR")}. Mostre-o apenas ao funcionário no aparelho aprovado.</p><button type="button" onClick={() => setPairCode(null)} className="mt-3 min-h-11 text-sm font-semibold text-success underline">Ocultar código</button></section>}

    <section className="mt-6 rounded-card bg-surface p-5 shadow-card sm:p-6">
      <h2 className="text-lg font-semibold text-foreground">Registrar aparelho</h2>
      <form onSubmit={(event) => void createDevice(event)} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm font-medium text-foreground">Apelido<input required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Cel Almox 3" className="mt-1 block min-h-11 w-full rounded-control border border-border px-3" /></label>
        <label className="text-sm font-medium text-foreground">Funcionário<select required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="mt-1 block min-h-11 w-full rounded-control border border-border bg-surface px-3"><option value="">Selecione</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.nome} · {employee.cracha}</option>)}</select></label>
        <button type="submit" disabled={busy || devices.filter((device) => !device.revogadoEm).length >= limit} className="min-h-11 rounded-control bg-brand px-4 text-sm font-semibold text-surface transition-colors hover:bg-brand-hover active:bg-brand-pressed disabled:cursor-wait disabled:opacity-50">{busy ? "Criando…" : "Criar código"}</button>
      </form>
    </section>

    <section className="mt-6" aria-label="Aparelhos cadastrados">
      <h2 className="text-lg font-semibold text-foreground">Dispositivos</h2>
      {devices.length === 0 ? <EmptyState title="Nenhum aparelho cadastrado" message="Registre um aparelho para iniciar o pareamento seguro." /> : <div className="mt-3 grid gap-3">
        {devices.map((device) => <article key={device.id} className="flex flex-col gap-4 rounded-card bg-surface p-4 shadow-card sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div><div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold text-foreground">{device.nome}</h3><StatusBadge label={device.revogadoEm ? "Revogado" : device.pareadoEm ? "Pareado" : "Aguardando pareamento"} tone={device.revogadoEm ? "danger" : device.pareadoEm ? "success" : "warning"} /></div><p className="mt-2 text-sm text-text-secondary">Último acesso: {dateLabel(device.ultimoAcessoEm)}</p><ul className="mt-3 space-y-2 text-sm text-text-secondary">{device.credenciais.map((credential) => <li key={credential.id} className="flex flex-wrap items-center gap-2">{credential.funcionario.nome} · crachá {credential.funcionario.cracha} · consentido {dateLabel(credential.criadoEm)}<button type="button" disabled={busy} onClick={() => void removeCredential(device, credential.id, credential.funcionario.nome)} className="min-h-11 text-sm font-semibold text-error underline">Remover autenticador</button></li>)}</ul></div>
          <div className="flex flex-wrap gap-2">{!device.revogadoEm && <><button type="button" disabled={busy} onClick={() => void createPairing(device)} className="min-h-11 rounded-control border border-brand px-3 text-sm font-semibold text-brand hover:bg-priority-surface disabled:opacity-50">Novo código</button><button type="button" disabled={busy} onClick={() => void revokeDevice(device)} className="min-h-11 rounded-control border border-error/30 px-3 text-sm font-semibold text-error hover:bg-error-surface disabled:opacity-50">Revogar</button></>}</div>
        </article>)}
      </div>}
    </section>

    <section className="mt-6 rounded-card bg-surface p-5 shadow-card sm:p-6">
      <h2 className="text-lg font-semibold text-foreground">Acesso emergencial</h2><p className="mt-1 text-sm text-text-secondary">Liberação de uso único por até 15 minutos, com justificativa registrada.</p>
      <form onSubmit={(event) => void grantEmergencyAccess(event)} className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium text-foreground">Funcionário<select required value={emergencyUserId} onChange={(event) => setEmergencyUserId(event.target.value)} className="mt-1 block min-h-11 w-full rounded-control border border-border bg-surface px-3"><option value="">Selecione</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.nome} · {employee.cracha}</option>)}</select></label>
        <label className="text-sm font-medium text-foreground">Aparelho<select required value={emergencyDeviceId} onChange={(event) => setEmergencyDeviceId(event.target.value)} className="mt-1 block min-h-11 w-full rounded-control border border-border bg-surface px-3"><option value="">Selecione</option>{devices.filter((device) => !device.revogadoEm).map((device) => <option key={device.id} value={device.id}>{device.nome}</option>)}</select></label>
        <label className="text-sm font-medium text-foreground sm:col-span-2">Justificativa<input required minLength={10} maxLength={200} value={justification} onChange={(event) => setJustification(event.target.value)} className="mt-1 block min-h-11 w-full rounded-control border border-border px-3" /></label>
        <button type="submit" disabled={busy} className="min-h-11 self-end rounded-control border border-warning px-4 text-sm font-semibold text-warning hover:bg-warning-surface disabled:opacity-50">Liberar uma vez</button>
      </form>
    </section>
  </main>;
}