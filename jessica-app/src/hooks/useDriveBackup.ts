import { useEffect, useState } from "react";
import {
  appendDebugLog,
  createClientId,
  getConfiguredGoogleClientId,
  googleDriveClientIdKey,
  googleDriveScope,
  googleIdentityScriptUrl,
  oauthPendingActionKey,
  type AppView,
  type GoogleDriveFile,
  type GoogleDriveFileListResponse,
  type GoogleDriveUploadResponse,
  type OAuthPendingAction,
} from "../appSupport";

function isPwaStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

type UseDriveBackupArgs = {
  appView: AppView;
  selectedDate: string;
  getDayExportFile: () => File;
  loadFoodLogImportText: (text: string, fileName: string) => Promise<void>;
};

export function useDriveBackup({
  appView,
  selectedDate,
  getDayExportFile,
  loadFoodLogImportText,
}: UseDriveBackupArgs) {
  const [isExportPanelOpen, setIsExportPanelOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [exportDriveLink, setExportDriveLink] = useState("");
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);
  const [googleDriveClientId, setGoogleDriveClientId] = useState(() => getConfiguredGoogleClientId());
  const [driveImportFiles, setDriveImportFiles] = useState<GoogleDriveFile[]>([]);
  const [driveImportStatus, setDriveImportStatus] = useState("");
  const [isDriveImportOpen, setIsDriveImportOpen] = useState(false);
  const [isLoadingDriveImport, setIsLoadingDriveImport] = useState(false);

  function loadGoogleIdentityScript() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[src="${googleIdentityScriptUrl}"]`
      );

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("Google Identity script failed to load.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = googleIdentityScriptUrl;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google Identity script failed to load."));
      document.head.appendChild(script);
    });
  }

  async function getGoogleDriveAccessToken(
    clientId: string,
    pendingAction?: Pick<OAuthPendingAction, "action" | "fileId" | "fileName">
  ): Promise<string> {
    if (driveAccessToken) return driveAccessToken;

    if (isPwaStandalone()) {
      if (!pendingAction) throw new Error("PWA OAuth requires a pending action.");
      const pending: OAuthPendingAction = {
        ...pendingAction,
        clientId,
        returnView: appView,
        returnDate: selectedDate,
        timestamp: Date.now(),
      };
      localStorage.setItem(oauthPendingActionKey, JSON.stringify(pending));
      const redirectUri = window.location.origin + window.location.pathname;
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "token",
        scope: googleDriveScope,
      });
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      return new Promise(() => {}); // page is navigating away
    }

    await loadGoogleIdentityScript();
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) throw new Error("Google Identity Services is unavailable.");

    return new Promise<string>((resolve, reject) => {
      const tokenClient = oauth2.initTokenClient({
        client_id: clientId,
        scope: googleDriveScope,
        callback: (response) => {
          if (response.error || !response.access_token) {
            reject(new Error(response.error_description || response.error || "Google sign-in failed."));
            return;
          }
          resolve(response.access_token);
        },
      });
      tokenClient.requestAccessToken({ prompt: "consent" });
    });
  }

  async function getGoogleDriveUploadError(response: Response) {
    const fallback = `Google Drive upload failed (${response.status}).`;
    const errorText = await response.text();

    if (!errorText) return fallback;

    try {
      const parsed = JSON.parse(errorText) as {
        error?: {
          message?: string;
          status?: string;
        };
      };
      return parsed.error?.message || parsed.error?.status || fallback;
    } catch {
      return errorText;
    }
  }

  async function getGoogleDriveRequestError(response: Response, action: string) {
    const fallback = `Google Drive ${action} failed (${response.status}).`;
    const errorText = await response.text();

    if (!errorText) return fallback;

    try {
      const parsed = JSON.parse(errorText) as {
        error?: {
          message?: string;
          status?: string;
        };
      };
      return parsed.error?.message || parsed.error?.status || fallback;
    } catch {
      return errorText;
    }
  }

  async function _doOpenDriveImport(token: string) {
    setIsLoadingDriveImport(true);
    setDriveImportStatus("Loading JSON files from Google Drive...");
    try {
      const params = new URLSearchParams({
        pageSize: "20",
        orderBy: "modifiedTime desc",
        spaces: "drive",
        fields: "files(id,name,modifiedTime,size)",
        q: "(mimeType='application/json' or name contains '.json') and trashed=false",
      });
      const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(await getGoogleDriveRequestError(response, "file list"));
      const result = (await response.json()) as GoogleDriveFileListResponse;
      const files = result.files ?? [];
      setDriveImportFiles(files);
      setIsDriveImportOpen(true);
      setDriveImportStatus(files.length > 0 ? "" : "No JSON files were available to this app in Google Drive.");
    } catch (error) {
      setDriveImportStatus(error instanceof Error ? error.message : "Google Drive import failed.");
    } finally {
      setIsLoadingDriveImport(false);
    }
  }

  async function _doImportDriveFile(token: string, fileId: string, fileName: string) {
    setIsLoadingDriveImport(true);
    setDriveImportStatus(`Loading ${fileName}...`);
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(await getGoogleDriveRequestError(response, "file download"));
      await loadFoodLogImportText(await response.text(), fileName);
      setDriveImportStatus("");
      setIsDriveImportOpen(false);
      setIsExportPanelOpen(false);
    } catch (error) {
      setDriveImportStatus(error instanceof Error ? error.message : "Could not import that Google Drive file.");
    } finally {
      setIsLoadingDriveImport(false);
    }
  }

  /**
   * Finds an existing, app-visible Drive file with this exact name so repeat
   * exports of the same day update one file instead of accumulating copies.
   * With the drive.file scope this only ever sees files this app created.
   */
  async function findExistingDriveFileId(token: string, fileName: string): Promise<string | null> {
    const params = new URLSearchParams({
      pageSize: "1",
      spaces: "drive",
      fields: "files(id)",
      q: `name='${fileName.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}' and trashed=false`,
    });
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(await getGoogleDriveRequestError(response, "file lookup"));
    const result = (await response.json()) as GoogleDriveFileListResponse;
    return result.files?.[0]?.id ?? null;
  }

  async function _doUploadToDrive(token: string) {
    setIsUploadingToDrive(true);
    setExportStatus("Uploading to Google Drive...");
    try {
      const file = getDayExportFile();
      const existingFileId = await findExistingDriveFileId(token, file.name);
      const metadata = { name: file.name, mimeType: "application/json" };
      const boundary = `jessica_${createClientId().replace(/[^a-zA-Z0-9]/g, "")}`;
      const body = new Blob(
        [
          `--${boundary}\r\n`,
          "Content-Type: application/json; charset=UTF-8\r\n\r\n",
          JSON.stringify(metadata),
          "\r\n",
          `--${boundary}\r\n`,
          "Content-Type: application/json\r\n\r\n",
          await file.text(),
          "\r\n",
          `--${boundary}--`,
        ],
        { type: `multipart/related; boundary=${boundary}` }
      );
      const uploadUrl = existingFileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingFileId)}?uploadType=multipart&fields=id,name,webViewLink`
        : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink";
      const response = await fetch(uploadUrl, {
        method: existingFileId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      });
      if (!response.ok) throw new Error(await getGoogleDriveUploadError(response));
      const uploaded = (await response.json()) as GoogleDriveUploadResponse;
      setExportDriveLink(uploaded.webViewLink ?? "");
      setExportStatus(
        existingFileId
          ? `Updated ${uploaded.name ?? file.name} in Google Drive.`
          : `Uploaded ${uploaded.name ?? file.name} to Google Drive.`
      );
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Google Drive upload failed.");
    } finally {
      setIsUploadingToDrive(false);
    }
  }

  async function resumePendingOAuthAction(pending: OAuthPendingAction, token: string) {
    switch (pending.action) {
      case "import-list":
        setExportDriveLink("");
        setDriveImportFiles([]);
        await _doOpenDriveImport(token);
        break;
      case "import-file":
        if (pending.fileId && pending.fileName) {
          await _doImportDriveFile(token, pending.fileId, pending.fileName);
        }
        break;
      case "export":
        setExportDriveLink("");
        setIsExportPanelOpen(true);
        await _doUploadToDrive(token);
        break;
    }
  }

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token=")) return;
    const params = new URLSearchParams(hash.substring(1));
    const token = params.get("access_token");
    if (!token) return;
    window.history.replaceState(null, "", window.location.origin + window.location.pathname + window.location.search);
    const pendingRaw = localStorage.getItem(oauthPendingActionKey);
    localStorage.removeItem(oauthPendingActionKey);

    queueMicrotask(() => {
      setDriveAccessToken(token);
      if (!pendingRaw) return;

      try {
        const pending = JSON.parse(pendingRaw) as OAuthPendingAction;
        if (Date.now() - pending.timestamp > 10 * 60 * 1000) return;
        setGoogleDriveClientId(pending.clientId);
        resumePendingOAuthAction(pending, token);
      } catch (error) {
        appendDebugLog("oauth-pending-action-parse-failed", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function openDriveImport() {
    if (isLoadingDriveImport) return;
    const clientId = googleDriveClientId.trim();
    setExportDriveLink("");
    setDriveImportFiles([]);
    if (!clientId) { setExportStatus("Add your Google OAuth Client ID first."); return; }
    localStorage.setItem(googleDriveClientIdKey, clientId);
    setDriveImportStatus("Authorizing with Google...");
    try {
      const token = await getGoogleDriveAccessToken(clientId, { action: "import-list" });
      await _doOpenDriveImport(token);
    } catch (error) {
      setDriveImportStatus(error instanceof Error ? error.message : "Google Drive import failed.");
      setIsLoadingDriveImport(false);
    }
  }

  async function importGoogleDriveFile(file: GoogleDriveFile) {
    if (isLoadingDriveImport) return;
    const clientId = googleDriveClientId.trim();
    if (!clientId) { setDriveImportStatus("Add your Google OAuth Client ID first."); return; }
    try {
      const token = await getGoogleDriveAccessToken(clientId, { action: "import-file", fileId: file.id, fileName: file.name });
      await _doImportDriveFile(token, file.id, file.name);
    } catch (error) {
      setDriveImportStatus(error instanceof Error ? error.message : "Could not import that Google Drive file.");
      setIsLoadingDriveImport(false);
    }
  }

  async function uploadDayExportToDrive() {
    if (isUploadingToDrive) return;
    const clientId = googleDriveClientId.trim();
    setExportDriveLink("");
    if (!clientId) { setExportStatus("Add your Google OAuth Client ID first."); return; }
    localStorage.setItem(googleDriveClientIdKey, clientId);
    setExportStatus("Authorizing with Google...");
    try {
      const token = await getGoogleDriveAccessToken(clientId, { action: "export" });
      await _doUploadToDrive(token);
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Google Drive upload failed.");
      setIsUploadingToDrive(false);
    }
  }

  return {
    isExportPanelOpen,
    setIsExportPanelOpen,
    exportStatus,
    setExportStatus,
    exportDriveLink,
    setExportDriveLink,
    isUploadingToDrive,
    googleDriveClientId,
    setGoogleDriveClientId,
    driveImportFiles,
    driveImportStatus,
    isDriveImportOpen,
    setIsDriveImportOpen,
    isLoadingDriveImport,
    openDriveImport,
    importGoogleDriveFile,
    uploadDayExportToDrive,
  };
}
