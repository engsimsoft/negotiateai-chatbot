/**
 * CloudConvert service for PPTX → PNG preview generation
 * Converts PPTX files to PNG images for browser preview
 */

import { put } from "@vercel/blob";

const CLOUDCONVERT_API_KEY = process.env.CLOUDCONVERT_API_KEY;
const CLOUDCONVERT_API_URL = "https://api.cloudconvert.com/v2";

interface CloudConvertTask {
  id: string;
  name: string;
  operation: string;
  status: string;
  result?: {
    files?: Array<{
      filename: string;
      url: string;
    }>;
  };
}

interface CloudConvertJob {
  id: string;
  status: string;
  tasks: CloudConvertTask[];
}

/**
 * Generate PNG preview images from PPTX buffer
 * @param pptxBuffer - The PPTX file as a Buffer
 * @param fileName - Original file name for reference
 * @returns Array of Vercel Blob URLs for preview images
 */
export async function generatePptxPreview(
  pptxBuffer: Buffer,
  fileName: string
): Promise<string[]> {
  console.log("[PPTX Preview] ========== Starting preview generation ==========");
  console.log("[PPTX Preview] File:", fileName);
  console.log("[PPTX Preview] Buffer size:", pptxBuffer.length, "bytes");
  console.log("[PPTX Preview] API key configured:", !!CLOUDCONVERT_API_KEY);

  if (!CLOUDCONVERT_API_KEY) {
    console.warn("[PPTX Preview] CLOUDCONVERT_API_KEY not set, skipping preview generation");
    return [];
  }

  try {
    console.log("[PPTX Preview] Step 1: Creating CloudConvert job...");
    // Step 1: Create a job with import, convert, and export tasks
    const jobResponse = await fetch(`${CLOUDCONVERT_API_URL}/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLOUDCONVERT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tasks: {
          "import-pptx": {
            operation: "import/upload",
          },
          // First convert PPTX → PDF (more reliable)
          "convert-to-pdf": {
            operation: "convert",
            input: ["import-pptx"],
            input_format: "pptx",
            output_format: "pdf",
          },
          // Then convert PDF → PNG (high quality)
          "convert-to-png": {
            operation: "convert",
            input: ["convert-to-pdf"],
            input_format: "pdf",
            output_format: "png",
            pixel_density: 150,
          },
          "export-png": {
            operation: "export/url",
            input: ["convert-to-png"],
          },
        },
      }),
    });

    if (!jobResponse.ok) {
      const error = await jobResponse.text();
      throw new Error(`Failed to create CloudConvert job: ${error}`);
    }

    const jobData = (await jobResponse.json()) as { data: CloudConvertJob };
    const job = jobData.data;
    console.log("[PPTX Preview] Job created:", job.id);

    // Step 2: Find the upload task and get the upload URL
    console.log("[PPTX Preview] Step 2: Getting upload URL...");
    const importTask = job.tasks.find((t) => t.name === "import-pptx");
    if (!importTask) {
      throw new Error("Import task not found in job");
    }
    console.log("[PPTX Preview] Import task ID:", importTask.id, "Status:", importTask.status);

    // Wait a moment for task to be ready (CloudConvert might need time)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get upload URL for the import task (correct endpoint: /tasks/{id})
    const uploadUrlResponse = await fetch(
      `${CLOUDCONVERT_API_URL}/tasks/${importTask.id}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${CLOUDCONVERT_API_KEY}`,
        },
      }
    );

    if (!uploadUrlResponse.ok) {
      const uploadUrlError = await uploadUrlResponse.text();
      console.error("[PPTX Preview] Upload URL error:", uploadUrlResponse.status, uploadUrlError);
      throw new Error(`Failed to get upload URL: ${uploadUrlResponse.status} - ${uploadUrlError}`);
    }

    const uploadUrlData = (await uploadUrlResponse.json()) as {
      data: { result: { form: { url: string; parameters: Record<string, string> } } };
    };
    console.log("[PPTX Preview] Upload URL response:", JSON.stringify(uploadUrlData, null, 2));

    if (!uploadUrlData.data?.result?.form?.url) {
      console.error("[PPTX Preview] Missing form URL in response");
      throw new Error("Upload form URL not found in response");
    }
    const uploadForm = uploadUrlData.data.result.form;
    console.log("[PPTX Preview] Upload URL:", uploadForm.url);

    // Step 3: Upload the PPTX file
    console.log("[PPTX Preview] Step 3: Uploading PPTX file...");
    const formData = new FormData();
    // Add form parameters from CloudConvert
    for (const [key, value] of Object.entries(uploadForm.parameters)) {
      formData.append(key, value);
    }
    // Add the file (convert Buffer to Uint8Array for Blob compatibility)
    formData.append("file", new Blob([new Uint8Array(pptxBuffer)]), fileName);

    const uploadResponse = await fetch(uploadForm.url, {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      const uploadError = await uploadResponse.text();
      throw new Error(`Failed to upload PPTX to CloudConvert: ${uploadError}`);
    }
    console.log("[PPTX Preview] Upload successful!");

    // Step 4: Wait for the job to complete
    console.log("[PPTX Preview] Step 4: Waiting for conversion (this may take 10-30 seconds)...");
    const waitResponse = await fetch(
      `${CLOUDCONVERT_API_URL}/jobs/${job.id}/wait`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${CLOUDCONVERT_API_KEY}`,
        },
      }
    );

    if (!waitResponse.ok) {
      throw new Error("Job wait failed");
    }

    const completedJobData = (await waitResponse.json()) as { data: CloudConvertJob };
    const completedJob = completedJobData.data;

    if (completedJob.status !== "finished") {
      throw new Error(`Job failed with status: ${completedJob.status}`);
    }
    console.log("[PPTX Preview] Conversion completed!");

    // Step 5: Get the exported PNG URLs
    console.log("[PPTX Preview] Step 5: Getting exported PNG URLs...");
    const exportTask = completedJob.tasks.find((t) => t.name === "export-png");
    if (!exportTask?.result?.files) {
      throw new Error("Export task has no files");
    }

    // Step 6: Download PNGs and upload to Vercel Blob for permanent storage
    console.log("[PPTX Preview] Step 6: Downloading and uploading", exportTask.result.files.length, "PNG files...");
    const previewUrls: string[] = [];

    for (const file of exportTask.result.files) {
      console.log("[PPTX Preview] Processing:", file.filename);
      // Download PNG from CloudConvert (temporary URL)
      const pngResponse = await fetch(file.url);
      if (!pngResponse.ok) {
        console.error(`Failed to download ${file.filename}`);
        continue;
      }

      const pngBuffer = await pngResponse.arrayBuffer();

      // Upload to Vercel Blob for permanent storage
      const blobResult = await put(
        `presentations/preview/${Date.now()}-${file.filename}`,
        pngBuffer,
        {
          access: "public",
          contentType: "image/png",
        }
      );

      previewUrls.push(blobResult.url);
      console.log("[PPTX Preview] Uploaded to Blob:", blobResult.url);
    }

    console.log("[PPTX Preview] ========== Preview generation complete ==========");
    console.log("[PPTX Preview] Generated", previewUrls.length, "preview images");
    return previewUrls;
  } catch (error) {
    console.error("[PPTX Preview] ========== ERROR ==========");
    console.error("[PPTX Preview] Error generating PPTX preview:", error);
    console.error("[PPTX Preview] Stack:", error instanceof Error ? error.stack : "N/A");
    return [];
  }
}

/**
 * Check remaining CloudConvert credits
 */
export async function checkCloudConvertCredits(): Promise<{
  used: number;
  remaining: number;
} | null> {
  if (!CLOUDCONVERT_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(`${CLOUDCONVERT_API_URL}/users/me`, {
      headers: {
        Authorization: `Bearer ${CLOUDCONVERT_API_KEY}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      data: { credits: number; creditsUsed: number };
    };
    return {
      used: data.data.creditsUsed || 0,
      remaining: data.data.credits || 0,
    };
  } catch {
    return null;
  }
}
