// Google Cloud Vision Text Detection — 가격표 사진에서 텍스트를 추출한다.
export async function extractTextFromImage(base64Image: string): Promise<string> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_CLOUD_VISION_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: "TEXT_DETECTION" }],
          },
        ],
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Vision API 요청 실패: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const response = data.responses?.[0];
  if (response?.error) {
    throw new Error(`Vision API 오류: ${response.error.message}`);
  }

  return response?.fullTextAnnotation?.text ?? "";
}
