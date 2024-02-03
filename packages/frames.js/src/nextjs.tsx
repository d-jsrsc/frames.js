import React, { useReducer } from "react";
import { ActionIndex, FrameActionPayload } from "./types";
import { NextRequest, NextResponse } from "next/server";
import { validateFrameMessage } from ".";
import { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type FrameState = Record<string, string>;

export type FrameElementType =
  | typeof FFrameButton
  | typeof FFrameImage
  | typeof FFFrameInput;

export type FrameContext<T extends FrameState = FrameState> = {
  frame_action_received: FrameActionPayload | null;
  frame_prev_state: T | null;
  pathname?: string;
  url: string;
  headers: ReadonlyHeaders;
};

type StringifiedValues<T> = {
  [K in keyof T]?: string;
};

export type FFrameUrlSearchParamsFlattened = StringifiedValues<FrameContext>;

export type FrameReducer<T extends FrameState = FrameState> = (
  state: T,
  action: FrameContext
) => T;

export async function validateFrameMessageOrThrow(
  frameActionPayload: FrameActionPayload | null
) {
  if (!frameActionPayload) {
    // no payload means no action
    return;
  }
  const { isValid } = await validateFrameMessage(frameActionPayload);
  if (!isValid) {
    throw new Error("frames.js: signature failed verification");
  }
}

export function createFrameContextNextjs<T extends FrameState = FrameState>(
  searchParams: Record<string, string>
): FrameContext<T> {
  return createFrameContext(parseFrameParams<T>(searchParams), headers());
}

export function createFrameContext<T extends FrameState = FrameState>(
  frameContextFromParams: Pick<
    FrameContext<T>,
    "frame_action_received" | "frame_prev_state" | "pathname"
  >,
  headers: ReadonlyHeaders
): FrameContext<T> {
  return {
    ...frameContextFromParams,
    headers: headers,
    // fixme:
    url: "",
  };
}

export function parseFrameParams<T extends FrameState = FrameState>(
  searchParams: Record<string, string>
): Pick<
  FrameContext<T>,
  "frame_action_received" | "frame_prev_state" | "pathname"
> {
  const frameActionReceived = searchParams.frame_action_received
    ? (JSON.parse(searchParams.frame_action_received) as FrameActionPayload)
    : null;

  const framePrevState = searchParams.frame_prev_state
    ? (JSON.parse(searchParams.frame_prev_state) as T)
    : null;

  return {
    frame_action_received: frameActionReceived,
    frame_prev_state: framePrevState,
    pathname: searchParams.pathname,
  };
}

export function useFramesReducer<T extends FrameState = FrameState>(
  reducer: FrameReducer<T>,
  initialState: T,
  initializerArg: FrameContext<T>
): T {
  function frameReducerInit(initial: FrameContext<T>): T {
    if (
      initial.frame_prev_state === null ||
      initial.frame_action_received === null
    )
      return initialState;

    // FIXME: if previous action was a redirect, needs to redirect here
    if (false) {
      redirect("");
    }
    return reducer(initial.frame_prev_state, initial);
  }

  return frameReducerInit(initializerArg);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { searchParams } = new URL(req.url);
  const generatedUrlWithNextFrameState = new URL(
    searchParams.get("pathname") || "/"
  );

  generatedUrlWithNextFrameState.searchParams.set(
    "frame_action_received",
    JSON.stringify(body)
  );
  generatedUrlWithNextFrameState.searchParams.set(
    "frame_prev_state",
    searchParams.get("frame_prev_state") ?? ""
  );

  // FIXME: does this need to return 200?
  return NextResponse.redirect(generatedUrlWithNextFrameState.toString());
}

export function FFrame<T extends FrameState = FrameState>({
  children,
  postRoute,
  state,
}: {
  postRoute: string;
  children: Array<React.ReactElement<FrameElementType>>;
  state: T;
}) {
  const nextIndexByComponentType = {
    button: 1,
    image: 1,
    input: 1,
  };

  const url = new URL(postRoute);
  const searchParams = new URLSearchParams();
  searchParams.set("pathname", url.pathname);
  searchParams.set("frame_prev_state", JSON.stringify(state));
  const postUrl = `${postRoute}?${searchParams.toString()}`;
  const newTree = (
    <>
      <meta name="fc:frame" content="vNext" />
      <meta name="fc:frame:post_url" content={postUrl} />
      {React.Children.map(children, (child) => {
        switch (child.type) {
          case FFrameButton:
            if (!React.isValidElement<typeof FFrameButton>(child)) {
              return child;
            }

            if (nextIndexByComponentType.button > 4) {
              throw new Error("too many buttons");
            }

            if (child.props.hasOwnProperty("href")) {
              return (
                <FFrameRedirect
                  {...(child.props as any)}
                  actionIndex={nextIndexByComponentType.button++}
                />
              );
            } else {
              return (
                <FFrameButtonShim
                  {...(child.props as any)}
                  actionIndex={nextIndexByComponentType.button++}
                />
              );
            }
          case FFFrameInput:
            if (nextIndexByComponentType.input > 1) {
              throw new Error("max one input allowed");
            }
            nextIndexByComponentType.input++;
            return child;
          case FFrameImage:
            if (nextIndexByComponentType.image > 1) {
              throw new Error("max one image allowed");
            }
            nextIndexByComponentType.image++;
            return child;
          default:
            throw new Error(
              "invalid child of <Frame>, must be a <FrameButton> or <FrameImage>"
            );
        }
      })}
    </>
  );

  if (nextIndexByComponentType.image === 1)
    throw new Error("an <FrameImage> element inside a <Frame> is required");

  return newTree;
}

export type FrameButtonAutomatedProps = {
  actionIndex: ActionIndex;
};

export type FrameButtonProvidedProps =
  | FrameButtonPostRedirectProvidedProps
  | FrameButtonPostProvidedProps;

export type FrameButtonPostProvidedProps = {
  children: string | number;
};
export type FrameButtonPostRedirectProvidedProps = {
  href: string;
  children: string | number;
};

export function FFrameRedirect({
  actionIndex,
  children,
}: FrameButtonPostRedirectProvidedProps & FrameButtonAutomatedProps) {
  return (
    <>
      {process.env.SHOW_UI ? <button type="button">{children}</button> : null}
      <meta
        name={`fc:frame:button:${actionIndex}`}
        content={String(children)}
      />
      <meta
        name={`fc:frame:button:${actionIndex}:action`}
        content={"post_redirect"}
      />
    </>
  );
}

export function FFrameButton(props: FrameButtonProvidedProps) {
  return null;
}

export function FFrameButtonShim({
  actionIndex,
  children,
}: FrameButtonPostProvidedProps & FrameButtonAutomatedProps) {
  return (
    <>
      {process.env.SHOW_UI ? <button type="button">{children}</button> : null}
      <meta
        name={`fc:frame:button:${actionIndex}`}
        content={String(children)}
      />
      <meta name={`fc:frame:button:${actionIndex}:action`} content={"post"} />
    </>
  );
}

export function FFFrameInput({ text }: { text: string }) {
  return (
    <>
      {process.env.SHOW_UI ? <input type="text" placeholder={text} /> : null}
      <meta name="fc:frame:input:text" content={text} />
    </>
  );
}

export function FFrameImage({ src }: { src: string }) {
  return (
    <>
      {process.env.SHOW_UI ? <img src={src} /> : null}
      <meta name="fc:frame:image" content={src} />
      <meta property="og:image" content={src} />
    </>
  );
}
