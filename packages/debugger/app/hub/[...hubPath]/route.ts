import { NextResponse, type NextRequest } from "next/server";
import { loadMockResponseForDebugHubRequest } from "../../utils/mock-hub-utils";

function getHubRequest(request: NextRequest, hubPath: string[]) {
  const { url, headers: originalHeaders, ...rest } = request;
  const newUrl = new URL(url);

  if (process.env.DEBUG_HUB_HTTP_URL) {
    const hubUrl = new URL(process.env.DEBUG_HUB_HTTP_URL);
    newUrl.protocol = hubUrl.protocol;
    newUrl.hostname = hubUrl.hostname;
    newUrl.port = hubUrl.port;
  } else {
    newUrl.protocol = "https";
    newUrl.hostname = "hub-api.neynar.com";
    newUrl.port = "443";
  }

  console.log("info: Mock hub: Forwarding message to", newUrl.toString());

  newUrl.pathname = hubPath.join("/");

  originalHeaders.set("api_key", "NEYNAR_FRAMES_JS");
  originalHeaders.delete("host");
  originalHeaders.delete("referer");

  const hubRequest = new Request(newUrl, {
    headers: originalHeaders,
    ...rest,
  });

  return hubRequest;
}

export async function GET(
  request: NextRequest,
  { params: { hubPath } }: { params: { hubPath: string[] } }
) {
  const mockResponse = await loadMockResponseForDebugHubRequest(
    request,
    hubPath
  );

  if (mockResponse) {
    return NextResponse.json(await mockResponse.json(), {
      status: mockResponse.status,
    });
  }

  console.warn(
    `info: Mock hub: Forwarding message ${hubPath.join("/")} to a real hub`
  );

  const hubRequest = getHubRequest(request, hubPath);
  const response = await fetch(hubRequest);
  return NextResponse.json(await response.json(), { status: response.status });
}

export async function POST(
  request: NextRequest,
  { params: { hubPath } }: { params: { hubPath: string[] } }
) {
  console.warn(
    `info: Mock hub: Forwarding message ${hubPath.join("/")} to a real hub`
  );

  const hubRequest = getHubRequest(request, hubPath);
  const response = await fetch(hubRequest);
  return NextResponse.json(await response.json(), { status: response.status });
}
