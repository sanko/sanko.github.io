const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const MarkdownIt = require('markdown-it');
const RSS = require('rss');
const Parser = require('rss-parser');
const ogs = require('open-graph-scraper');
const {
    Liquid
} = require('liquidjs');
require('dotenv').config();

// SETUP
const config = require('./config.json');
const emojiPlugin = require('markdown-it-emoji');

// Markdown parser (used inside Liquid filter)
const md = new MarkdownIt({
        html: true,
        linkify: true
    })
    .use(emojiPlugin.full || emojiPlugin);

// Liquid Engine
const engine = new Liquid();
// Register 'markdown' filter so we can use {{ item.body | markdown }} in the template
engine.registerFilter('markdown', (str) => md.render(str || ''));
engine.registerFilter('pluralize', (count, singular, plural) => {
    return count === 1 ? singular : (plural || singular + 's');
});

const rssParser = new Parser();
const slugify = txt => txt.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// State
let githubStatus = null;
let nowPost = null;

// Tag Mapping
const tagDisplayMap = {
    'notes': 'Notes',
    'commits': 'Commits',
    'bluesky': 'Bluesky',
    'video': 'Video',
    'bookmark': 'Reading',
    'social': 'Social',
    'rss': 'RSS',
    'mastodon': 'Mastodon',
    'lemmy': 'Lemmy'
};
if (config.github?.tag_overrides) {
    Object.assign(tagDisplayMap, config.github.tag_overrides);
}

// HELPERS

function getPrimaryGitHubUser() {
    if (config.profile.github_username) return config.profile.github_username;
    if (config.profile.socials) {
        const ghLink = config.profile.socials.find(s => s.name.toLowerCase() === 'github');
        if (ghLink && ghLink.url) return ghLink.url.replace(/\/$/, '').split('/').pop();
    }
    return null;
}

// FETCHERS

async function fetchOpenGraphData(url) {
    try {
        const { result } = await ogs({ url });
        return {
            image: result.ogImage?.[0]?.url || result.ogImage?.url || null,
            description: result.ogDescription || null
        };
    } catch (e) {
        // console.error(`OGS Error ${url}:`, e.result?.error || e.message); // Too noisy
        return { image: null, description: null };
    }
}

async function fetchGitHub() {
    if (!config.github?.sources) return [];
    console.log('Fetching GitHub...');
    const primaryUser = getPrimaryGitHubUser();
    const pagesRepo = primaryUser ? `${primaryUser}/${primaryUser}.github.io` : null;

    // Fetch User Status separately if possible
    if (primaryUser && !githubStatus) {
        try {
            const statusRes = await fetch('https://api.github.com/graphql', {
                method: 'POST',
                headers: {
                    'Authorization': `bearer ${process.env.GH_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: `query($user: String!) { user(login: $user) { status { emoji, message, indicatesLimitedAvailability } } }`,
                    variables: { user: primaryUser }
                })
            });
            const statusJson = await statusRes.json();
            if (statusJson.data?.user?.status) githubStatus = statusJson.data.user.status;
        } catch (e) {
            console.error('Error fetching user status:', e.message);
        }
    }

    const query = `query($owner: String!, $name: String!, $after: String) {
      repository(owner: $owner, name: $name) {
        discussions(first: 100, orderBy: {field: CREATED_AT, direction: DESC}, after: $after) {
          pageInfo { hasNextPage, endCursor }
          nodes { title, url, createdAt, body, author { login }, category { name }, labels(first: 5) { nodes { name } }, comments { totalCount }, reactions { totalCount } }
        }
        issues(first: 10, orderBy: {field: CREATED_AT, direction: DESC}) { nodes { title, url, createdAt, body, author { login }, labels(first: 5) { nodes { name } }, comments { totalCount }, reactions { totalCount } } }
        releases(first: 5, orderBy: {field: CREATED_AT, direction: DESC}) { nodes { tagName, url, publishedAt, description, name } }
      }
    }`;

    const allData = [];

    for (const source of config.github.sources) {
        const enableDiscussions = source.discussions !== false;
        const enableIssues = source.issues === true;
        const enableReleases = source.releases !== false;

        for (const repo of source.repos) {
            let hasNextPage = true;
            let endCursor = null;
            let firstRun = true;

            while (hasNextPage) {
                try {
                    const res = await fetch('https://api.github.com/graphql', {
                        method: 'POST',
                        headers: {
                            'Authorization': `bearer ${process.env.GH_TOKEN}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            query,
                            variables: {
                                owner: source.owner,
                                name: repo,
                                after: endCursor
                            }
                        })
                    });
                    const json = await res.json();
                    if (!json.data) {
                        // If we fail on a page, we might just stop this repo
                        console.error(`GH Error ${repo} (page): No data.`, json.errors || json);
                        break;
                    }

                    if (!json.data.repository) {
                        console.error(`GH Error ${repo}: Repository not found or access denied.`);
                        break;
                    }

                    const {
                        discussions,
                        issues,
                        releases
                    } = json.data.repository;
                    const repoSlug = slugify(repo);
                    const fullRepoName = `${source.owner}/${repo}`;
                    if (!tagDisplayMap[repoSlug]) tagDisplayMap[repoSlug] = repo;

                    const pushItem = (item, type, tags) => {
                        const groups = [];
                        const fullName = `${source.owner}/${repo}`;
                        if (config.github.groups) {
                            for (const [gName, rList] of Object.entries(config.github.groups)) {
                                if (rList.includes(fullName) || rList.includes(repo)) {
                                    const gSlug = slugify(gName);
                                    groups.push(gSlug);
                                    if (!tagDisplayMap[gSlug]) tagDisplayMap[gSlug] = gName;
                                }
                            }
                        }

                        // If the repo is part of a group, remove the individual repo tag
                        // unless the group tag itself matches the repo tag
                        let finalTags = [...tags, ...groups];
                        if (groups.length > 0) {
                            finalTags = finalTags.filter(t => t !== repoSlug || groups.includes(t));
                        }

                        allData.push({
                            sourceName: source.name,
                            type: type,
                            service: 'github',
                            owner: source.owner,
                            repo: repo,
                            date: new Date(item.createdAt || item.publishedAt),
                            title: item.title || item.name || item.tagName,
                            url: item.url,
                            body: item.body || item.description || "",
                            tags: [...new Set(finalTags)],
                            metrics: {
                                comments: item.comments?.totalCount || 0,
                                reactions: item.reactions?.totalCount || 0
                            }
                        });
                        console.log(`Collected: ${type} from ${repo}`);
                    };

                    if (enableDiscussions && discussions) {
                        discussions.nodes.forEach(d => {
                            // "Now" Page Logic
                            if (pagesRepo && fullRepoName === pagesRepo && d.category.name.toLowerCase() === 'announcements') {
                                const date = new Date(d.createdAt);
                                if (!nowPost || date > nowPost.date) nowPost = {
                                    body: d.body,
                                    date: date
                                };
                                return;
                            }
                            if (d.category.name.toLowerCase() === 'now') {
                                const date = new Date(d.createdAt);
                                if (!nowPost || date > nowPost.date) nowPost = {
                                    body: d.body,
                                    date: date
                                };
                                return;
                            }
                            if (d.category.name.toLowerCase() === 'drafts') return;

                            const isNote = d.category.name.toLowerCase() === 'notes';
                            const tags = [repoSlug];
                            d.labels.nodes.forEach(l => {
                                const lSlug = slugify(l.name).substring(0, 3);
                                tags.push(lSlug);
                                if (!tagDisplayMap[lSlug] && !config.github.tag_overrides?.[lSlug]) {
                                    tagDisplayMap[lSlug] = l.name.toUpperCase().substring(0, 3);
                                }
                            });
                            pushItem(d, isNote ? 'note' : 'article', tags);
                        });

                        if (discussions.pageInfo.hasNextPage) {
                            endCursor = discussions.pageInfo.endCursor;
                        } else {
                            hasNextPage = false;
                        }
                    } else {
                        // If discussions are not enabled or not present, we still want to proceed to fetch releases/issues on the first run
                        hasNextPage = false;
                    }

                    if (firstRun) {
                        if (enableIssues && issues) {
                            issues.nodes.forEach(i => {
                                const tags = [repoSlug, 'issue'];
                                i.labels.nodes.forEach(l => tags.push(slugify(l.name).substring(0, 3)));
                                pushItem(i, 'article', tags);
                            });
                        }

                        if (enableReleases && releases) {
                            releases.nodes.forEach(r => pushItem(r, 'release', ['commits', repoSlug]));
                        }
                        firstRun = false;
                    }

                } catch (e) {
                    console.error(`GH Error ${repo}:`, e.message);
                    hasNextPage = false;
                }
            }
        }
    }
    return allData;
}

async function fetchBluesky() {
    if (!config.bluesky?.sources) return [];
    console.log('Fetching Bluesky...');
    const allData = [];
    for (const source of config.bluesky.sources) {
        try {
            let url = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${source.handle}&filter=posts_no_replies&limit=20`;
            if (source.feed) url = `https://public.api.bsky.app/xrpc/app.bsky.feed.getFeed?feed=${source.feed}&limit=20`;

            const res = await fetch(url);
            const json = await res.json();
            if (!json.feed) continue;

            json.feed.forEach(item => {
                const post = item.post;
                let imageUrl = post.embed?.images?.[0]?.fullsize || null;
                allData.push({
                    sourceName: source.name,
                    type: 'note',
                    service: 'bluesky',
                    date: new Date(post.record.createdAt),
                    body: post.record.text,
                    url: `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`,
                    image: imageUrl,
                    tags: ['notes'],
                    metrics: {
                        replies: post.replyCount,
                        reposts: post.repostCount,
                        likes: post.likeCount
                    }
                });
            });
        } catch (e) {
            console.error(`Bluesky Error ${source.handle}:`, e.message);
        }
    }
    return allData;
}

async function fetchMastodon() {
    if (!config.mastodon?.sources) return [];
    console.log('Fetching Mastodon...');
    const allData = [];
    for (const source of config.mastodon.sources) {
        try {
            const res = await fetch(`https://${source.instance}/api/v1/accounts/${source.id}/statuses?exclude_replies=true&limit=20`);
            const json = await res.json();
            if (!Array.isArray(json)) continue;
            json.forEach(post => {
                let imageUrl = post.media_attachments?.[0]?.url || null;
                allData.push({
                    sourceName: source.name,
                    type: 'note',
                    service: 'mastodon',
                    date: new Date(post.created_at),
                    body: post.content.replace(/<[^>]*>?/gm, ''),
                    url: post.url,
                    image: imageUrl,
                    tags: ['notes'],
                    metrics: {
                        replies: post.replies_count,
                        reposts: post.reblogs_count,
                        likes: post.favourites_count
                    }
                });
            });
        } catch (e) {
            console.error(`Mastodon Error:`, e.message);
        }
    }
    return allData;
}

async function fetchLemmy() {
    if (!config.lemmy?.sources) return [];
    console.log('Fetching Lemmy...');
    const allData = [];
    for (const source of config.lemmy.sources) {
        try {
            const res = await fetch(`https://${source.instance}/api/v3/user?username=${source.username}&limit=10`);
            const json = await res.json();
            if (json.person_view && json.person_view.posts) {
                json.person_view.posts.forEach(p => {
                    allData.push({
                        sourceName: source.name,
                        type: 'note',
                        service: 'lemmy',
                        date: new Date(p.post.published),
                        body: p.post.body || p.post.name,
                        url: p.post.ap_id,
                        tags: ['social'],
                        metrics: {
                            likes: p.counts.score,
                            replies: p.counts.comments
                        }
                    });
                });
            }
        } catch (e) {
            console.error('Lemmy Error:', e.message);
        }
    }
    return allData;
}

async function fetchRaindrop() {
    if (!config.raindrop?.collection_id || !process.env.RAINDROP_TOKEN) return [];
    console.log('Fetching Raindrop...');
    try {
        const res = await fetch(`https://api.raindrop.io/rest/v1/raindrops/${config.raindrop.collection_id}`, {
            headers: {
                'Authorization': `Bearer ${process.env.RAINDROP_TOKEN}`
            }
        });
        const json = await res.json();
        if (!json.items) return [];
        return json.items.map(item => ({
            sourceName: config.raindrop.name || 'bookmarks',
            type: 'bookmark',
            service: 'raindrop',
            date: new Date(item.created),
            title: item.title,
            url: item.link,
            body: item.note || "",
            image: item.cover || null,
            tags: ['bookmark', ...item.tags],
            metrics: {}
        }));
    } catch (e) {
        console.error('Raindrop Error:', e.message);
        return [];
    }
}

async function fetchYouTube() {
    if (!config.youtube?.sources) return [];
    console.log('Fetching YouTube...');
    const allData = [];
    const parser = new Parser();

    for (const source of config.youtube.sources) {
        try {
            const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${source.channel_id}`);
            feed.items.forEach(item => {
                const mediaGroup = item['media:group'];
                const thumb = mediaGroup ? mediaGroup['media:thumbnail'][0].$.url : null;
                allData.push({
                    sourceName: source.name,
                    type: 'video',
                    service: 'youtube',
                    date: new Date(item.pubDate),
                    title: item.title,
                    url: item.link,
                    body: "",
                    image: thumb,
                    tags: ['video']
                });
            });
        } catch (e) {
            console.error('YT Error:', e.message);
        }
    }
    return allData;
}

async function fetchRSS() {
    if (!config.rss?.sources) return [];
    console.log('Fetching RSS...');
    const allData = [];
    const parser = new Parser();
    for (const source of config.rss.sources) {
        try {
            const feed = await parser.parseURL(source.url);
            // Limit concurrent OGS fetches
            for (const item of feed.items.slice(0, 10)) {
                const bodyText = (item.contentSnippet || item.content || "").trim();
                let ogData = { image: null, description: null };
                if (item.link) {
                   ogData = await fetchOpenGraphData(item.link);
                }

                allData.push({
                    sourceName: source.name,
                    type: 'article',
                    service: 'rss',
                    owner: source.name,
                    repo: 'feed',
                    date: new Date(item.pubDate || item.isoDate),
                    title: item.title,
                    url: item.link,
                    body: bodyText,
                    image: ogData.image,
                    tags: ['rss', slugify(source.name)],
                    metrics: {}
                });
            }
        } catch (e) {
            console.error(`RSS Error ${source.name}:`, e.message);
        }
    }
    return allData;
}

async function fetchGitLab() {
    if (!config.gitlab?.sources) return [];
    console.log('Fetching GitLab...');
    const allData = [];
    for (const source of config.gitlab.sources) {
        try {
            const headers = process.env.GITLAB_TOKEN ? {
                'PRIVATE-TOKEN': process.env.GITLAB_TOKEN
            } : {};
            const res = await fetch(`https://${config.gitlab.instance || 'gitlab.com'}/api/v4/projects/${source.id}/releases`, {
                headers
            });
            const json = await res.json();
            if (!Array.isArray(json)) continue;
            json.forEach(r => {
                allData.push({
                    sourceName: source.name,
                    type: 'release',
                    service: 'gitlab',
                    owner: 'gitlab',
                    repo: source.id,
                    date: new Date(r.released_at),
                    title: r.name,
                    version: r.tag_name,
                    url: r._links.self,
                    body: r.description || "",
                    tags: ['commits']
                });
            });
        } catch (e) {
            console.error('GitLab Error:', e.message);
        }
    }
    return allData;
}

async function fetchGitea() {
    if (!config.gitea?.sources) return [];
    console.log('Fetching Gitea...');
    const allData = [];
    for (const source of config.gitea.sources) {
        try {
            const headers = process.env.GITEA_TOKEN ? {
                'Authorization': `token ${process.env.GITEA_TOKEN}`
            } : {};
            const res = await fetch(`https://${config.gitea.instance}/api/v1/repos/${source.owner}/${source.repo}/releases?limit=5`, {
                headers
            });
            const json = await res.json();
            if (!Array.isArray(json)) continue;
            json.forEach(r => {
                allData.push({
                    sourceName: source.name,
                    type: 'release',
                    service: 'gitea',
                    owner: source.owner,
                    repo: source.repo,
                    date: new Date(r.published_at),
                    version: r.tag_name,
                    url: r.html_url,
                    body: r.body || "",
                    tags: ['commits', slugify(source.repo)]
                });
            });
        } catch (e) {
            console.error('Gitea Error:', e.message);
        }
    }
    return allData;
}

async function fetchBitbucket() {
    if (!config.bitbucket?.sources) return [];
    console.log('Fetching Bitbucket...');
    const allData = [];
    for (const source of config.bitbucket.sources) {
        try {
            const headers = process.env.BITBUCKET_APP_PASS ? {
                'Authorization': `Basic ${Buffer.from(`${config.bitbucket.username}:${process.env.BITBUCKET_APP_PASS}`).toString('base64')}`
            } : {};
            const res = await fetch(`https://api.bitbucket.org/2.0/repositories/${source.workspace}/${source.repo_slug}/refs/tags?sort=-target.date`, {
                headers
            });
            const json = await res.json();
            if (!json.values) continue;
            json.values.slice(0, 5).forEach(tag => {
                allData.push({
                    sourceName: source.name,
                    type: 'release',
                    service: 'bitbucket',
                    owner: source.workspace,
                    repo: source.repo_slug,
                    date: new Date(tag.target.date),
                    version: tag.name,
                    url: tag.links.html.href,
                    body: tag.message || "Tag release",
                    tags: ['commits', slugify(source.repo_slug)]
                });
            });
        } catch (e) {
            console.error('Bitbucket Error:', e.message);
        }
    }
    return allData;
}

// DATA PREP

function prepareTemplateData(allContent, uniqueTags) {
    // 1. Filter List
    const types = ['notes', 'commits', 'video', 'bookmark', 'rss'];
    const knownRepos = config.github?.sources ? config.github.sources.flatMap(s => s.repos.map(r => slugify(r))) : [];
    const knownGroups = config.github?.groups ? Object.keys(config.github.groups).map(g => slugify(g)) : [];

    const groups = {
        types: [],
        repos: [],
        groups: [],
        topics: []
    };

    Array.from(uniqueTags).forEach(tag => {
        const name = tagDisplayMap[tag] || tag;
        const item = {
            id: tag,
            name: name
        };

        if (types.includes(tag)) {
            item.color = '--c-accent';
            groups.types.push(item);
        } else if (knownRepos.includes(tag)) groups.repos.push(item);
        else if (knownGroups.includes(tag)) groups.groups.push(item);
        else groups.topics.push(item);
    });

    const filter_sections = [];
    if (groups.types.length) filter_sections.push(groups.types);
    if (groups.groups.length) filter_sections.push(groups.groups.sort((a, b) => a.name.localeCompare(b.name)));
    if (groups.repos.length) filter_sections.push(groups.repos.sort((a, b) => a.name.localeCompare(b.name)));
    if (groups.topics.length) filter_sections.push(groups.topics.sort((a, b) => a.name.localeCompare(b.name)));

    // 2. Timeline
    const timeline = [];
    const byYear = {};
    allContent.forEach((item, index) => {
        const year = item.date.getFullYear();
        if (!byYear[year]) byYear[year] = [];

        // Generate a simple ID for permalinks
        // Using date + index to ensure uniqueness if titles missing
        const dateStr = item.date.toISOString().slice(0, 10);
        item.id = `entry-${dateStr}-${index}`;

        // Calculate helper properties for Liquid
        item.tag_classes = item.tags.map(t => `tag-${t}`).join(' ');
        item.sourceLabel = item.service === 'bluesky' ? 'Bluesky' : (item.service === 'mastodon' ? 'Mastodon' : (item.repo ? item.repo : 'Note'));

        if (item.type === 'article' && item.body) {
            // Find the first line that has text and is NOT a Header (#)
            const raw = item.body.split('\n').find(l => l.trim().length > 0 && !l.trim().startsWith('#')) || "";

            // Assign the raw markdown line directly to summary
            item.summary = raw;
        }

        byYear[year].push(item);
    });

    Object.keys(byYear).sort((a, b) => b - a).forEach(year => {
        timeline.push({
            year: year,
            items: byYear[year]
        });
    });

    // 3. Status Object (Pass raw strings, let Liquid filter handle emoji rendering)
    let statusObj = null;
    if (githubStatus) {
        const emojiHtml = md.renderInline(githubStatus.emoji || '💭');
        statusObj = {
            emoji: emojiHtml,
            message: githubStatus.message,
            busyClass: githubStatus.indicatesLimitedAvailability ? 'status-busy' : ''
        };
    }

    // 4. Now Post (Raw)
    let nowObj = null;
    if (nowPost) {
        nowObj = {
            body: nowPost.body,
            date: nowPost.date
        };
    }

    return {
        profile: config.profile,
        analytics: config.analytics,
        feeds: config.feeds ? Object.keys(config.feeds).map(k => ({
            file: k,
            ...config.feeds[k],
            mime: config.feeds[k].type === 'atom' ? 'application/atom+xml' : 'application/rss+xml'
        })) : [],
        year_range: config.profile.copyright_start == new Date().getFullYear() ? `${config.profile.copyright_start}` : `${config.profile.copyright_start}–${new Date().getFullYear()}`,
        filters: Array.from(uniqueTags).map(t => ({
            id: t
        })),
        filter_sections: filter_sections,
        timeline: timeline,
        status: statusObj,
        now: nowObj
    };
}

// FEED GENERATION

function generateFeedFiles(allContent) {
    if (!config.feeds) return;
    const p = config.profile;

    Object.entries(config.feeds).forEach(([filename, settings]) => {
        const feedItems = allContent.filter(item => {
            if (settings.sources.includes('*')) return true;
            return settings.sources.includes(item.sourceName);
        }).slice(0, 20);

        const feed = new RSS({
            title: settings.title || p.name,
            description: p.tagline,
            feed_url: `${p.url}/${filename}`,
            site_url: p.url,
            author: p.name
        });

        feedItems.forEach(item => {
            feed.item({
                title: item.title || 'Note',
                description: item.body,
                url: item.url,
                date: item.date,
                guid: item.url
            });
        });

        const dir = path.dirname(filename);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, {
            recursive: true
        });
        fs.writeFileSync(filename, feed.xml({
            indent: true
        }));
    });
}

// MAIN

async function build() {
    console.log("Starting Build...");

    const results = await Promise.allSettled([
        fetchGitHub(), fetchBluesky(), fetchMastodon(), fetchLemmy(),
        fetchYouTube(), fetchRaindrop(), fetchGitLab(), fetchGitea(), fetchBitbucket(), fetchRSS()
    ]);

    const allContent = results
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => r.value)
        .sort((a, b) => b.date - a.date);

    console.log(`Total items collected: ${allContent.length}`);

    const uniqueTags = new Set();
    allContent.forEach(item => item.tags.forEach(t => uniqueTags.add(t)));

    // Prepare Data for Liquid
    const data = prepareTemplateData(allContent, uniqueTags);

    // Render Template
    const template = fs.readFileSync('index.liquid', 'utf8');
    const html = await engine.parseAndRender(template, data);
    fs.writeFileSync('index.html', html);

    // Generate Feeds
    generateFeedFiles(allContent);

    //~ const prettyJson = JSON.stringify(data, null, 2); // Indent with 2 spaces
    //~ console.log(prettyJson);

    console.log("Build complete.");
}

build();
