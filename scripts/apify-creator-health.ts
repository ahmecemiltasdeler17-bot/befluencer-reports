/**
 * One-shot sanitized Apify health probe for creator sync diagnosis.
 * Never prints tokens or full payloads.
 */
import { readFileSync } from "node:fs";

function loadEnvLocal() {
  for (const raw of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvLocal();
  const token = process.env.APIFY_API_TOKEN?.trim() ?? "";
  const actorId = process.env.APIFY_TIKTOK_ACTOR_ID?.trim() ?? "";
  const creatorActor =
    process.env.APIFY_TIKTOK_CREATOR_ACTOR_ID?.trim() || actorId;

  console.log(
    JSON.stringify(
      {
        tokenPresent: token.length > 0,
        actorIdPresent: actorId.length > 0,
        actorId,
        creatorActorId: creatorActor,
        creatorActorSameAsVideo: creatorActor === actorId,
      },
      null,
      2
    )
  );

  if (!token || !actorId) {
    process.exit(1);
  }

  const headers = { Authorization: `Bearer ${token}` };

  const me = await fetch("https://api.apify.com/v2/users/me", { headers });
  console.log("users/me HTTP", me.status);
  if (me.ok) {
    const json = (await me.json()) as {
      data?: { username?: string; plan?: { id?: string } };
    };
    console.log(
      "users/me ok",
      JSON.stringify({
        username: json.data?.username ?? null,
        planId: json.data?.plan?.id ?? null,
      })
    );
  } else {
    console.log("users/me fail snippet", (await me.text()).slice(0, 200));
  }

  const limits = await fetch("https://api.apify.com/v2/users/me/limits", {
    headers,
  });
  console.log("users/me/limits HTTP", limits.status);
  if (limits.ok) {
    const json = (await limits.json()) as {
      data?: {
        current?: Record<string, unknown>;
        limits?: Record<string, unknown>;
      };
    };
    const current = json.data?.current ?? {};
    const lim = json.data?.limits ?? {};
    console.log(
      "limits summary",
      JSON.stringify({
        maxMonthlyActorComputeUnits: lim.maxMonthlyActorComputeUnits ?? null,
        monthlyActorComputeUnits: current.monthlyActorComputeUnits ?? null,
        maxMonthlyUsageUsd: lim.maxMonthlyUsageUsd ?? null,
      })
    );
  } else {
    console.log("limits fail snippet", (await limits.text()).slice(0, 200));
  }

  const act = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(creatorActor)}`,
    { headers }
  );
  console.log("actor HTTP", act.status);
  if (act.ok) {
    const json = (await act.json()) as {
      data?: { name?: string; username?: string; title?: string; isPublic?: boolean };
    };
    console.log(
      "actor ok",
      JSON.stringify({
        name: json.data?.name ?? null,
        username: json.data?.username ?? null,
        title: json.data?.title ?? null,
        isPublic: json.data?.isPublic ?? null,
      })
    );
  } else {
    console.log("actor fail snippet", (await act.text()).slice(0, 300));
  }

  // Start one short controlled profile run (waitForFinish).
  console.log("starting one controlled creator run…");
  const start = Date.now();
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(creatorActor)}/runs?waitForFinish=90&memory=1024`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        profiles: ["tiktok"],
        profileScrapeSections: ["videos"],
        profileSorting: "latest",
        resultsPerPage: 1,
        excludePinnedPosts: true,
        searchQueries: [],
        shouldDownloadCovers: false,
        shouldDownloadVideos: false,
        shouldDownloadSubtitles: false,
        shouldDownloadSlideshowImages: false,
        shouldDownloadAvatars: false,
        shouldDownloadMusicCovers: false,
        startUrls: [{ url: "https://www.tiktok.com/@tiktok" }],
      }),
    }
  );
  console.log("run start HTTP", runRes.status);
  const runText = await runRes.text();
  let runJson: {
    data?: {
      id?: string;
      status?: string;
      defaultDatasetId?: string;
      defaultKeyValueStoreId?: string;
      statusMessage?: string;
    };
    error?: { type?: string; message?: string };
  } = {};
  try {
    runJson = JSON.parse(runText) as typeof runJson;
  } catch {
    console.log("run body non-json snippet", runText.slice(0, 300));
  }

  console.log(
    JSON.stringify(
      {
        httpStatus: runRes.status,
        runId: runJson.data?.id ?? null,
        status: runJson.data?.status ?? null,
        defaultDatasetIdPresent: Boolean(runJson.data?.defaultDatasetId),
        defaultKeyValueStoreIdPresent: Boolean(
          runJson.data?.defaultKeyValueStoreId
        ),
        statusMessage: runJson.data?.statusMessage ?? null,
        errorType: runJson.error?.type ?? null,
        errorMessage: runJson.error?.message ?? null,
        durationMs: Date.now() - start,
      },
      null,
      2
    )
  );

  if (runJson.data?.id && runJson.data.status !== "SUCCEEDED") {
    // poll once more
    const poll = await fetch(
      `https://api.apify.com/v2/actor-runs/${runJson.data.id}`,
      { headers }
    );
    const pollJson = (await poll.json()) as {
      data?: { status?: string; statusMessage?: string };
    };
    console.log(
      "poll",
      JSON.stringify({
        http: poll.status,
        status: pollJson.data?.status ?? null,
        statusMessage: pollJson.data?.statusMessage ?? null,
      })
    );
  }

  if (runJson.data?.defaultDatasetId) {
    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${runJson.data.defaultDatasetId}/items?clean=1&format=json`,
      { headers }
    );
    const items = (await itemsRes.json()) as unknown;
    console.log(
      "dataset",
      JSON.stringify({
        http: itemsRes.status,
        count: Array.isArray(items) ? items.length : -1,
      })
    );
  }

  if (runJson.data?.defaultKeyValueStoreId) {
    const kv = await fetch(
      `https://api.apify.com/v2/key-value-stores/${runJson.data.defaultKeyValueStoreId}/records/AUTHOR_CACHE`,
      { headers }
    );
    console.log(
      "AUTHOR_CACHE",
      JSON.stringify({
        http: kv.status,
        present: kv.status === 200,
      })
    );
  }
}

main().catch((error: unknown) => {
  const err = error as Error;
  console.error("probe_failed", err.name, err.message);
  process.exit(1);
});
