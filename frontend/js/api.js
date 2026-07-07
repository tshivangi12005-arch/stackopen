// api.js — Supabase-powered real backend

const SUPABASE_URL = 'https://stouydhiadngnrjpgvps.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0b3V5ZGhpYWRuZ25yanBndnBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MjQwMzcsImV4cCI6MjA5MDEwMDAzN30.st13RAS3KOG0hpYLTnO-q_p5sLPm4mxgr9SmTbs1pVY';

const SB = {
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  },

  async query(table, params = '') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
      headers: this.headers
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async insert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...this.headers, 'Prefer': 'return=representation' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async update(table, match, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
      method: 'PATCH',
      headers: { ...this.headers, 'Prefer': 'return=representation' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async delete(table, match) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
      method: 'DELETE',
      headers: this.headers
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  }
};

const API = {

  getCurrentUser() {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  },

  async fetchPosts(search = '') {
    let posts;
    if (search) {
        const results = await SB.query('posts',
            `?or=(title.ilike.*${encodeURIComponent(search)}*,body.ilike.*${encodeURIComponent(search)}*)&order=created_at.desc`
        );
        const tagMatches = await SB.query('posts',
            `?tags=cs.{${encodeURIComponent(search.toLowerCase())}}&order=created_at.desc`
        );
        const seen = new Set(results.map(p => p.id));
        tagMatches.forEach(p => { if (!seen.has(p.id)) results.push(p); });
        posts = results;
    } else {
        posts = await SB.query('posts', '?order=created_at.desc');
    }

    // Get answer counts for all posts in one query
    const answers = await SB.query('answers', '?select=post_id');
    const countMap = {};
    answers.forEach(a => {
        countMap[a.post_id] = (countMap[a.post_id] || 0) + 1;
    });

    // Attach answer count to each post
    return posts.map(p => ({
        ...p,
        answerCount: countMap[p.id] || 0
    }));
  },

  async fetchTrending() {
    return SB.query('posts', '?order=votes.desc&limit=5');
  },

  async fetchUnanswered() {
    return SB.query('posts', '?is_answered=eq.false&order=created_at.desc&limit=5');
  },

  async fetchPostById(postId) {
    const posts = await SB.query('posts', `?id=eq.${postId}`);
    if (!posts.length) throw new Error('Post not found');
    const post = posts[0];
    const answers = await SB.query('answers', `?post_id=eq.${postId}&order=votes.desc`);
    return { ...post, answers };
  },

  async checkDuplicates(title) {
    if (!title || title.length < 8) return [];

    const stopWords = new Set(['what','this','that','with','from','have','will','your','when','where','which','how','the','and','for','are','but','not','you','all','can','was','one','our','out','who','get','use','into','than','then','its','also','about','been','does','did','just','should','would','could','between','difference','a','an','is','do','i','to','in','of','it','me','we']);

    const words = title.toLowerCase()
        .replace(/[^a-z0-9 ]/g, '')
        .split(' ')
        .filter(w => w.length > 3 && !stopWords.has(w));

    if (!words.length) return [];

    // Pick the 2 most specific words (longest = most specific)
    const topWords = words.sort((a, b) => b.length - a.length).slice(0, 2);

    // ONE query using the most specific word
    const results = await SB.query('posts', `?title=ilike.*${encodeURIComponent(topWords[0])}*&limit=10`);

    // Filter client-side for second word match
    return results
        .filter(post => {
            const t = post.title.toLowerCase();
            return topWords.every(w => t.includes(w)) || 
                   (topWords.length === 1 && t.includes(topWords[0]));
        })
        .slice(0, 4);
  },

  async createPost(postData) {
    const user = this.getCurrentUser();
    const tags = postData.tags
      ? postData.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];
    const result = await SB.insert('posts', {
      title: postData.title,
      body: postData.body,
      tags,
      author: user?.username || 'anonymous'
    });
    // Update user score (recompute)
    await this._updateScore(user?.username);
    return result[0];
  },

  async deletePost(postId) {
    const user = this.getCurrentUser();
    const posts = await SB.query('posts', `?id=eq.${postId}`);
    if (!posts.length) throw new Error('Post not found');
    const post = posts[0];
    if (post.author !== user?.username) throw new Error('Unauthorized');

    // Get all answers on this post (before deletion)
    const answers = await SB.query('answers', `?post_id=eq.${postId}&select=author`);
    const answerAuthors = new Set();
    answers.forEach(ans => answerAuthors.add(ans.author));

    await SB.delete('posts', `id=eq.${postId}`); // cascade deletes answers

    // Recompute post author
    await this._updateScore(post.author);

    // Recompute each answer author
    for (const author of answerAuthors) {
      await this._updateScore(author);
    }

    return { success: true };
  },
  
  async createAnswer(postId, body) {
    const user = this.getCurrentUser();
    const result = await SB.insert('answers', {
      post_id: postId,
      body,
      author: user?.username || 'anonymous'
    });
    // Mark post as answered + update score
    await SB.update('posts', `id=eq.${postId}`, { is_answered: true });
    await this._updateScore(user?.username);
    return result[0];
  },

  async deleteAnswer(answerId) {
    const user = this.getCurrentUser();
    const answers = await SB.query('answers', `?id=eq.${answerId}`);
    if (!answers.length) throw new Error('Answer not found');
    const answer = answers[0];
    if (answer.author !== user?.username) throw new Error('Unauthorized');

    await SB.delete('answers', `id=eq.${answerId}`);

    // Recompute the answer author's score
    await this._updateScore(answer.author);

    return { success: true };
  },

  async voteOnPost(postId, voteType) {
    const posts = await SB.query('posts', `?id=eq.${postId}`);
    if (!posts.length) return;
    const current = posts[0].votes || 0;
    await SB.update('posts', `id=eq.${postId}`, {
      votes: voteType === 'upvote' ? current + 1 : current - 1
    });
    return { success: true };
  },

  async voteOnAnswer(answerId, voteType) {
    const answers = await SB.query('answers', `?id=eq.${answerId}`);
    if (!answers.length) return;
    const current = answers[0].votes || 0;
    await SB.update('answers', `id=eq.${answerId}`, {
      votes: voteType === 'upvote' ? current + 1 : current - 1
    });
    return { success: true };
  },

  async getLeaderboard() {
    return SB.query('users', '?order=score.desc&limit=10');
  },

  async getUserPosts(username) {
    return SB.query('posts', `?author=eq.${username}&order=created_at.desc`);
  },

  async getUserAnswers(username) {
    return SB.query('answers', `?author=eq.${username}&order=created_at.desc`);
  },

  async getUserProfile(username) {
    const users = await SB.query('users', `?username=eq.${username}`);
    return users[0] || null;
  },

  async _updateScore(username) {
    if (!username) return;

    // Fetch the user's posts and answers (only need ids for counting)
    const posts = await SB.query('posts', `?author=eq.${username}&select=id`);
    const answers = await SB.query('answers', `?author=eq.${username}&select=id`);

    const questions = posts.length;
    const ansCount = answers.length;
    const newScore = (ansCount * 10) + (questions * 3);

    const level = newScore >= 150 ? 'Expert' : newScore >= 50 ? 'Contributor' : 'Beginner';

    // Check if user exists, if not create them (should exist already but safe)
    let users = await SB.query('users', `?username=eq.${username}`);
    if (!users.length) {
      await SB.insert('users', { username, score: newScore, level });
    } else {
      await SB.update('users', `username=eq.${username}`, { score: newScore, level });
    }
  },

  async login(username, password) {
    // Fetch user from Supabase and verify password
    const users = await SB.query('users', `?username=eq.${username}`);
    
    if (!users.length) {
      throw new Error('Invalid credentials');
    }

    const user = users[0];

    // Check if password matches
    if (user.password !== password) {
      throw new Error('Invalid credentials');
    }

    // Password is correct - login successful
    return { token: 'sb-mock-token', user: { username: user.username, email: user.email } };
  },

  async signup(username, password, email) {
    if (!username || !password) throw new Error('Invalid data');
    
    // Check if username taken
    const existing = await SB.query('users', `?username=eq.${username}`);
    
    if (existing.length) throw new Error('Username already taken');
    
    // Insert new user with password
    await SB.insert('users', { username, email, password, score: 0, level: 'Beginner' });
    
    return { token: 'sb-mock-token', user: { username, email } };
  },

  async changePassword(username, currentPassword, newPassword) {
    // Fetch user and verify current password
    const users = await SB.query('users', `?username=eq.${username}`);
    
    if (!users.length) {
      throw new Error('User not found');
    }

    const user = users[0];

    // Verify current password matches
    if (user.password !== currentPassword) {
      throw new Error('Current password is incorrect');
    }

    // Update password in database
    await SB.update('users', `username=eq.${username}`, { password: newPassword });

    return { success: true, message: 'Password updated successfully' };
  }

};