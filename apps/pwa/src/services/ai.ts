import promptTemplate from "../features/ai/prompt-template.md?raw";

export type AiPromptContext = {
  repoName?: string;
  branch?: string;
  repoOverview?: string;
  issueTitle?: string;
  issueBody?: string;
  userRequest?: string;
  targetFlow?: string;
  relevantFiles?: string;
  acceptanceCriteria?: string;
  constraints?: string;
  additionalContext?: string;
};

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const PLACEHOLDER_MAP: Record<keyof AiPromptContext, string> = {
  repoName: "repo_name",
  branch: "current_branch",
  repoOverview: "repo_overview",
  issueTitle: "issue_title",
  issueBody: "issue_body",
  userRequest: "user_request",
  targetFlow: "target_flow",
  relevantFiles: "relevant_files",
  acceptanceCriteria: "acceptance_criteria",
  constraints: "constraints",
  additionalContext: "additional_context",
};

const DEFAULT_VALUES: AiPromptContext = {
  repoName: "",
  branch: "",
  repoOverview: "",
  issueTitle: "",
  issueBody: "",
  userRequest: "",
  targetFlow: "",
  relevantFiles: "",
  acceptanceCriteria: "",
  constraints: "",
  additionalContext: "",
};

function applyPromptTemplate(template: string, context: AiPromptContext) {
  return (Object.keys(PLACEHOLDER_MAP) as Array<keyof AiPromptContext>).reduce(
    (nextTemplate, key) => {
      const value = (context[key] ?? DEFAULT_VALUES[key]) as string;
      const placeholder = PLACEHOLDER_MAP[key];
      const pattern = new RegExp(`{{\\s*${placeholder}\\s*}}`, "g");
      return nextTemplate.replace(pattern, value);
    },
    template
  );
}

export function buildAiPrompt(context: AiPromptContext) {
  return applyPromptTemplate(promptTemplate, context);
}

export type AiChatRequest = {
  context: AiPromptContext;
  messages: AiChatMessage[];
  endpoint?: string;
};

export async function requestAiSupport({ context, messages, endpoint = "/api/ai/chat" }: AiChatRequest) {
  const prompt = buildAiPrompt(context);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      messages,
      context,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`AI request failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}
