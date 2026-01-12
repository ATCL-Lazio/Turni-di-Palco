export type GithubIssuePayload = {
  title: string;
  body?: string;
  labels?: string[];
};

export type GithubIssueOptions = {
  owner: string;
  repo: string;
  token: string;
  apiUrl?: string;
};

export async function createGithubIssue(options: GithubIssueOptions, payload: GithubIssuePayload) {
  const { owner, repo, token, apiUrl = "https://api.github.com" } = options;
  const response = await fetch(`${apiUrl}/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      title: payload.title,
      body: payload.body ?? "",
      labels: payload.labels ?? [],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub issue creation failed (${response.status}): ${errorText}`);
  }

  return response.json();
}
