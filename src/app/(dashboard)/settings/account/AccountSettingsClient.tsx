"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, LockKeyhole, Mail, Save, UserRound } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SecuritySettingsPanel } from "../security/SecuritySettingsPanel";

interface AccountUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

interface Props {
  initialUser: AccountUser;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

async function readApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.success) {
    throw new Error(payload.error ?? "Die Aenderung konnte nicht gespeichert werden.");
  }
  return payload;
}

export function AccountSettingsClient({ initialUser }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState(initialUser);
  const [email, setEmail] = useState(initialUser.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const initials = useMemo(() => getInitials(user.name), [user.name]);

  const saveEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setSavingProfile(true);
    try {
      const payload = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }).then((response) => readApiResponse<AccountUser>(response));
      if (payload.data) {
        setUser(payload.data);
        setEmail(payload.data.email);
        router.refresh();
      }
      setMessage({ type: "success", text: "E-Mail-Adresse wurde gespeichert." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "E-Mail-Adresse konnte nicht gespeichert werden.",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Die neuen Passwoerter stimmen nicht ueberein." });
      return;
    }
    setSavingPassword(true);
    try {
      await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      }).then((response) => readApiResponse<{ changed: boolean }>(response));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage({ type: "success", text: "Passwort wurde aktualisiert." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Passwort konnte nicht geaendert werden.",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const payload = await fetch("/api/account/avatar", {
        method: "POST",
        body: formData,
      }).then((response) => readApiResponse<AccountUser>(response));
      if (payload.data) {
        setUser(payload.data);
        router.refresh();
      }
      setMessage({ type: "success", text: "Profilbild wurde aktualisiert." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Profilbild konnte nicht hochgeladen werden.",
      });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Konto</h1>
        <p className="mt-1 text-sm text-gray-500">
          Verwalte deine E-Mail-Adresse, dein Profilbild und dein Passwort.
        </p>
      </div>

      {message && (
        <Alert variant={message.type === "success" ? "success" : "error"}>
          {message.text}
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader className="items-start">
            <div>
              <CardTitle>Profil</CardTitle>
              <CardDescription>Name ist systemseitig festgelegt und nicht aenderbar.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-primary/10 text-primary">
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-bold">
                    {initials || <UserRound className="h-8 w-8" />}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-4">
                <Input label="Name" value={user.name} readOnly disabled icon={<UserRound className="h-4 w-4" />} />
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => uploadAvatar(event.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    loading={uploadingAvatar}
                    icon={<Camera className="h-4 w-4" />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Profilbild aendern
                  </Button>
                  <p className="mt-2 text-xs text-gray-500">JPG, PNG oder WebP bis maximal 2 MB.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <form onSubmit={saveEmail}>
              <CardHeader>
                <div>
                  <CardTitle>E-Mail-Adresse</CardTitle>
                  <CardDescription>Diese Adresse wird fuer Anmeldung und Benachrichtigungen genutzt.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Input
                  label="E-Mail-Adresse"
                  type="email"
                  value={email}
                  required
                  icon={<Mail className="h-4 w-4" />}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </CardContent>
              <CardFooter className="justify-end">
                <Button
                  type="submit"
                  loading={savingProfile}
                  disabled={email.trim().toLowerCase() === user.email.toLowerCase()}
                  icon={<Save className="h-4 w-4" />}
                >
                  Speichern
                </Button>
              </CardFooter>
            </form>
          </Card>

          <Card>
            <form onSubmit={savePassword}>
              <CardHeader>
                <div>
                  <CardTitle>Passwort</CardTitle>
                  <CardDescription>Setze ein neues Passwort mit mindestens 12 Zeichen.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Input
                    label="Aktuelles Passwort"
                    type="password"
                    value={currentPassword}
                    required
                    icon={<LockKeyhole className="h-4 w-4" />}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                </div>
                <Input
                  label="Neues Passwort"
                  type="password"
                  value={newPassword}
                  minLength={12}
                  required
                  icon={<LockKeyhole className="h-4 w-4" />}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
                <Input
                  label="Neues Passwort bestaetigen"
                  type="password"
                  value={confirmPassword}
                  minLength={12}
                  required
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </CardContent>
              <CardFooter className="justify-end">
                <Button
                  type="submit"
                  loading={savingPassword}
                  disabled={!currentPassword || newPassword.length < 12 || newPassword !== confirmPassword}
                  icon={<Save className="h-4 w-4" />}
                >
                  Passwort speichern
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>

      <SecuritySettingsPanel embedded />
    </div>
  );
}
