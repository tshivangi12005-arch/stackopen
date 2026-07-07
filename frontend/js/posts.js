// posts.js – Functions for rendering posts and handling votes, answers, etc.

let allPosts = [];

function renderPosts(posts) {
    const container = document.getElementById('postsContainer');
    if (!container) return;

    const countEl = document.getElementById('questionCount');
    if (countEl) countEl.textContent = `${posts.length} question${posts.length !== 1 ? 's' : ''}`;

    if (posts.length === 0) {
        container.innerHTML = `
            <div class="not-found">
                <i class="fas fa-search"></i>
                <h3>No results found</h3>
                <p>No questions match your search</p>
                <a href="create-post.html" class="btn btn-primary">Ask this question</a>
            </div>`;
        return;
    }

    container.innerHTML = posts.map(post => `
        <article class="post-card" data-post-id="${post.id}">
            <div class="post-header">
                <div class="vote-section">
                    <button class="vote-btn upvote" data-id="${post.id}" data-type="post"><i class="fas fa-chevron-up"></i></button>
                    <span class="vote-count">${post.votes || 0}</span>
                    <button class="vote-btn downvote" data-id="${post.id}" data-type="post"><i class="fas fa-chevron-down"></i></button>
                </div>
                <div class="post-content">
                    <h2 class="post-title"><a href="post.html?id=${post.id}">${escapeHTML(post.title)}</a></h2>
                    <p class="post-excerpt">${escapeHTML(post.body.substring(0, 120))}${post.body.length > 120 ? '...' : ''}</p>
                    <div class="post-meta">
                        <span class="post-author">👤 ${escapeHTML(post.author)}</span>
                        <span class="post-time">${timeAgo(post.created_at)}</span>
                        <div class="post-tags">
                            ${(post.tags || []).map(tag => `<span class="tag" data-tag="${encodeURIComponent(tag)}">${escapeHTML(tag)}</span>`).join('')}
                        </div>
                        <span class="comment-count"><i class="far fa-comment"></i> ${post.answerCount || 0}</span>
                    </div>
                </div>
            </div>
        </article>
    `).join('');

    // Attach tag click handlers (redirect to community page)
    container.querySelectorAll('.post-tags .tag').forEach(tagEl => {
        tagEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const tag = tagEl.dataset.tag;
            if (tag) window.location.href = `community.html?name=${tag}`;
        });
    });

    // Attach vote handlers
    document.querySelectorAll('.vote-btn.upvote, .vote-btn.downvote').forEach(btn => {
        btn.addEventListener('click', handleVote);
    });
}

async function loadAndRenderPosts(searchTerm = '') {
    const container = document.getElementById('postsContainer');
    if (!container) return;
    
    try {
        let posts;
        if (searchTerm) {
            posts = await API.fetchPosts(searchTerm);
            if (!posts.length) {
                container.innerHTML = `
                    <div class="not-found">
                        <i class="fas fa-search"></i>
                        <h3>No results found</h3>
                        <p>No questions or tags matching "<strong>${escapeHTML(searchTerm)}</strong>"</p>
                        <a href="create-post.html" class="btn btn-primary">Ask this question</a>
                    </div>`;
                return;
            }
        } else {
            posts = await API.fetchPosts();
            allPosts = posts;
        }
        allPosts = posts;
        renderPosts(posts);
    } catch (error) {
        console.error('Failed to load posts:', error);
        if (container) container.innerHTML = '<p class="error">Failed to load posts.</p>';
    }
}

async function loadAndRenderPostDetail(postId) {
    try {
        const post = await API.fetchPostById(postId);
        renderPostDetail(post);
    } catch (error) {
        console.error('Failed to load post:', error);
        const container = document.getElementById('postDetailContainer');
        if (container) {
            container.innerHTML = '<p class="error">Post not found. <a href="index.html">Return to home</a></p>';
        }
    }
}

function renderPostDetail(post) {
    const container = document.getElementById('postDetailContainer');
    if (!container) return;

    if (!post) {
        container.innerHTML = '<p class="error">Post not found.</p>';
        return;
    }

    const currentUser = API.getCurrentUser();
    const isAuthor = currentUser && currentUser.username === post.author;

    const deleteButton = isAuthor ?
        `<button id="deletePostBtn" class="btn btn-danger" style="margin-left: auto;">Delete Post</button>` : '';

    const html = `
        <article class="post-detail-card" data-post-id="${post.id}">
            <div class="post-header">
                <div class="vote-section">
                    <button class="vote-btn upvote" data-id="${post.id}" data-type="post"><i class="fas fa-chevron-up"></i></button>
                    <span class="vote-count">${post.votes || 0}</span>
                    <button class="vote-btn downvote" data-id="${post.id}" data-type="post"><i class="fas fa-chevron-down"></i></button>
                </div>
                <div class="post-content">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <h1 class="post-title">${escapeHTML(post.title)}</h1>
                        ${deleteButton}
                    </div>
                    <div class="post-meta">
                        <span class="post-author">${escapeHTML(post.author)}</span>
                        <span class="post-time">${timeAgo(post.created_at)}</span>
                        <div class="post-tags">
                            ${(post.tags || []).map(tag => `<span class="tag" data-tag="${encodeURIComponent(tag)}">${escapeHTML(tag)}</span>`).join('')}
                        </div>
                    </div>
                    <div class="post-body">
                        ${escapeHTML(post.body).replace(/\n/g, '<br>')}
                    </div>
                </div>
            </div>
        </article>

        <section class="answers-section">
            <h2>${post.answers ? post.answers.length : 0} Answers</h2>
            <div id="answersList">
                ${post.answers ? post.answers.map(answer => `
                    <div class="answer-card" data-answer-id="${answer.id}">
                        <div class="post-header">
                            <div class="vote-section">
                                <button class="vote-btn upvote" data-id="${answer.id}" data-type="answer"><i class="fas fa-chevron-up"></i></button>
                                <span class="vote-count">${answer.votes || 0}</span>
                                <button class="vote-btn downvote" data-id="${answer.id}" data-type="answer"><i class="fas fa-chevron-down"></i></button>
                            </div>
                            <div class="post-content">
                                <div class="answer-body">
                                    ${escapeHTML(answer.body).replace(/\n/g, '<br>')}
                                </div>
                                <div class="answer-meta">
                                    <span>answered ${timeAgo(answer.created_at)} by ${escapeHTML(answer.author)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('') : '<p>No answers yet.</p>'}
            </div>
        </section>

        <div class="add-answer-form">
            <h3>Your Answer</h3>
            <textarea id="answerBody" rows="4" placeholder="Write your answer here... Be descriptive and helpful."></textarea>
            <button id="submitAnswer" class="btn btn-primary">Post Answer</button>
            <div id="answerError" class="error-message"></div>
        </div>
    `;

    container.innerHTML = html;

    // Attach tag click handlers for post detail
    container.querySelectorAll('.post-tags .tag').forEach(tagEl => {
        tagEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const tag = tagEl.dataset.tag;
            if (tag) window.location.href = `community.html?name=${tag}`;
        });
    });

    // Attach vote handlers
    document.querySelectorAll('.vote-btn.upvote, .vote-btn.downvote').forEach(btn => {
        btn.addEventListener('click', handleVote);
    });

    const submitBtn = document.getElementById('submitAnswer');
    if (submitBtn) {
        submitBtn.addEventListener('click', () => handleAnswerSubmit(post.id));
    }

    const deleteBtn = document.getElementById('deletePostBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => handleDeletePost(post.id));
    }
}

async function handleVote(event) {
    const btn = event.currentTarget;
    const id = btn.dataset.id;
    const type = btn.dataset.type;
    const voteType = btn.classList.contains('upvote') ? 'upvote' : 'downvote';

    const voteSpan = btn.parentElement.querySelector('.vote-count');
    let current = parseInt(voteSpan.textContent, 10);
    voteSpan.textContent = current + (voteType === 'upvote' ? 1 : -1);

    try {
        if (type === 'post') {
            await API.voteOnPost(id, voteType);
        } else {
            await API.voteOnAnswer(id, voteType);
        }
    } catch (error) {
        voteSpan.textContent = current;
        console.error('Vote failed:', error);
    }
}

async function handleAnswerSubmit(postId) {
    const answerBody = document.getElementById('answerBody').value.trim();
    const errorDiv = document.getElementById('answerError');

    if (!answerBody) {
        errorDiv.textContent = 'Answer cannot be empty.';
        return;
    }

    if (!localStorage.getItem('token')) {
        window.location.href = `login.html?redirect=post.html?id=${postId}`;
        return;
    }

    try {
        await API.createAnswer(postId, answerBody);
        loadAndRenderPostDetail(postId);
    } catch (error) {
        errorDiv.textContent = 'Failed to post answer. Try again.';
    }
}

async function handleDeletePost(postId) {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
        return;
    }
    try {
        await API.deletePost(postId);
        window.location.href = 'index.html';
    } catch (error) {
        alert('Failed to delete post: ' + error.message);
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>"]/g, function(match) {
        if (match === '&') return '&amp;';
        if (match === '<') return '&lt;';
        if (match === '>') return '&gt;';
        if (match === '"') return '&quot;';
        return match;
    });
}

function timeAgo(dateString) {
    const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
}

// Kept for reference (no longer used for tag clicks)
function filterByTag(tag) {
    document.querySelectorAll('.tag').forEach(t => t.classList.remove('tag-active'));
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = tag;
    const filtered = allPosts.filter(post =>
        (post.tags || []).some(t => t.toLowerCase() === tag.toLowerCase())
    );
    renderPosts(filtered);
}