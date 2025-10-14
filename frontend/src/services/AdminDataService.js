// Simple in-memory Admin data service (JavaScript)
// Provides dashboard data and CRUD-like helpers for posts/updates

let postsStore = [
  {
    id: '1',
    title: 'System Maintenance Tonight',
    description: 'Brief maintenance window starting at 10:00 PM. Expect short downtime.',
    category: 'Event',
    // Human friendly date for UI; isoDate drives calendar sorting/grouping
    date: 'Sep 12, 2025',
    isoDate: new Date(2025, 8, 12).toISOString(), // Sep 12, 2025
    images: [],
    image: undefined,
    isPinned: true,
    isUrgent: true,
    source: 'Admin',
  },
  {
    id: '2',
    title: 'Academic Orientation',
    description: 'Welcome session for incoming students at the auditorium.',
    category: 'Academic',
    date: 'Sep 11, 2025',
    isoDate: new Date(2025, 8, 11).toISOString(),
    images: [],
    image: undefined,
    isPinned: false,
    isUrgent: false,
    source: 'Admin',
  },
  {
    id: '3',
    title: 'Announcement: New Library Hours',
    description: 'Library will open at 7:30 AM starting next week.',
    category: 'Announcement',
    date: 'Sep 12, 2025',
    isoDate: new Date(2025, 8, 12).toISOString(),
    images: [],
    image: undefined,
    isPinned: false,
    isUrgent: false,
    source: 'Admin',
  },
  {
    id: '4',
    title: 'Student Council Elections',
    description: 'Voting for student council representatives will be held in the main auditorium. All students are encouraged to participate in the democratic process.',
    category: 'Event',
    date: 'Sep 15, 2025',
    isoDate: new Date(2025, 8, 15).toISOString(),
    images: [],
    image: undefined,
    isPinned: true,
    isUrgent: false,
    source: 'Admin',
  },
  {
    id: '5',
    title: 'Scholarship Application Deadline',
    description: 'Deadline for submitting scholarship applications is approaching. Please ensure all required documents are submitted before the cutoff date.',
    category: 'Academic',
    date: 'Sep 18, 2025',
    isoDate: new Date(2025, 8, 18).toISOString(),
    images: [],
    image: undefined,
    isPinned: false,
    isUrgent: true,
    source: 'Admin',
  },
  {
    id: '6',
    title: 'Campus Cleanup Drive',
    description: 'Join us for the monthly campus cleanup drive. Meet at the main gate at 8:00 AM. All volunteers will receive certificates of participation.',
    category: 'Event',
    date: 'Sep 20, 2025',
    isoDate: new Date(2025, 8, 19).toISOString(),
    images: [],
    image: undefined,
    isPinned: false,
    isUrgent: false,
    source: 'Admin',
  },
];
let idCounter = 7;

const delay = (ms = 250) => new Promise(resolve => setTimeout(resolve, ms));

function normalizeImages(images) {
  if (!images) return [];
  if (Array.isArray(images)) return images.filter(Boolean);
  if (typeof images === 'string' && images.trim().length > 0) return [images.trim()];
  return [];
}

function toIsoDate(input) {
  if (!input) return new Date().toISOString();
  const asDate = new Date(input);
  if (!isNaN(asDate.getTime())) return asDate.toISOString();
  if (typeof input === 'string' && input.includes('/')) {
    const m = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const dd = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10) - 1;
      const yyyy = parseInt(m[3], 10);
      const d = new Date(yyyy, mm, dd);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }
  // Fallback now
  return new Date().toISOString();
}

function dateToSortKey(post) {
  const iso = post?.isoDate || post?.date;
  const t = Date.parse(iso);
  if (!isNaN(t)) return t;
  // Try dd/mm/yyyy fallback
  if (typeof iso === 'string') {
    const m = iso.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const dd = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10) - 1;
      const yyyy = parseInt(m[3], 10);
      return new Date(yyyy, mm, dd).getTime();
    }
  }
  return 0;
}

const AdminDataService = {
  async getPosts() {
    await delay();
    // Pinned first, then newest by date
    return [...postsStore].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const da = dateToSortKey(a);
      const db = dateToSortKey(b);
      return db - da;
    });
  },

  async getPostById(id) {
    await delay();
    return postsStore.find(p => p.id === String(id)) || null;
  },

  async createPost(partial) {
    await delay();
    const images = normalizeImages(partial?.images);
    const firstImage = images.length > 0 ? images[0] : undefined;
    const nowIso = new Date().toISOString();
    const chosenIso = toIsoDate(partial?.date || nowIso);
    const next = {
      id: String(idCounter++),
      title: partial?.title || 'Untitled',
      description: partial?.description || '',
      category: partial?.category || 'General',
      date: partial?.date || nowIso,
      isoDate: chosenIso,
      images,
      image: firstImage,
      isPinned: Boolean(partial?.isPinned),
      isUrgent: Boolean(partial?.isUrgent),
      source: partial?.source || 'Admin',
    };
    postsStore = [next, ...postsStore];
    return next;
  },

  async updatePost(id, updates) {
    await delay();
    let updated = null;
    postsStore = postsStore.map(p => {
      if (p.id === String(id)) {
        const images = normalizeImages(updates?.images ?? p.images);
        const firstImage = images.length > 0 ? images[0] : undefined;
        const nextDate = updates?.date !== undefined ? updates.date : p.date;
        updated = {
          ...p,
          title: updates?.title ?? p.title,
          description: updates?.description ?? p.description,
          category: updates?.category ?? p.category,
          date: nextDate,
          isoDate: toIsoDate(nextDate || p.isoDate || p.date),
          images,
          image: firstImage,
          isPinned: typeof updates?.isPinned === 'boolean' ? updates.isPinned : p.isPinned,
          isUrgent: typeof updates?.isUrgent === 'boolean' ? updates.isUrgent : p.isUrgent,
          source: updates?.source ?? p.source,
        };
        return updated;
      }
      return p;
    });
    return updated;
  },

  async deletePost(id) {
    await delay();
    const before = postsStore.length;
    postsStore = postsStore.filter(p => p.id !== String(id));
    return postsStore.length < before;
  },

  async togglePin(id) {
    await delay();
    let updated = null;
    postsStore = postsStore.map(p => {
      if (p.id === String(id)) {
        const next = { ...p, isPinned: !p.isPinned };
        updated = next;
        return next;
      }
      return p;
    });
    return updated;
  },

  async getDashboard(/* period */) {
    await delay();
    const totalUpdates = postsStore.length;
    const pinnedCount = postsStore.filter(p => p.isPinned).length;
    const urgentCount = postsStore.filter(p => p.isUrgent).length;

    const recentUpdates = [...postsStore]
      .sort((a, b) => dateToSortKey(b) - dateToSortKey(a))
      .slice(0, 20)
      .map(p => ({
      title: p.title,
      date: p.date,
      tag: p.category,
      description: p.description,
      images: p.images,
      image: p.image || (Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : undefined),
      pinned: p.isPinned,
      source: p.source || 'Admin',
    }));

    return {
      totalUpdates,
      pinned: pinnedCount,
      urgent: urgentCount,
      recentUpdates,
    };
  },
};

export default AdminDataService;



