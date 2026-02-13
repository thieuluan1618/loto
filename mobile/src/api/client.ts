import { Platform } from "react-native";

const PROD_URL = "https://loto-app.thankfulplant-70f11e56.eastus.azurecontainerapps.io/api/v1";

const getBaseUrl = () => {
  return PROD_URL;
};

const API_URL = getBaseUrl();

export interface Block {
  row1: number[];
  row2: number[];
  row3: number[];
}

export interface ScanResult {
  scan_id?: string;
  lottery_type: string;
  blocks?: Block[];
  all_numbers: number[];
  ticket_id?: string;
  confidence: number;
  status: string;
  notes?: string;
}

export async function scanTicket(imageUri: string): Promise<ScanResult> {
  const formData = new FormData();

  const filename = imageUri.split("/").pop() || "ticket.jpg";
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";

  if (Platform.OS === "web") {
    const resp = await fetch(imageUri);
    const blob = await resp.blob();
    formData.append("image", blob, filename);
  } else {
    formData.append("image", {
      uri: imageUri,
      name: filename,
      type: mimeType,
    } as unknown as Blob);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  const response = await fetch(`${API_URL}/scan-ticket`, {
    method: "POST",
    body: formData,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Scan failed");
  }

  return response.json();
}
