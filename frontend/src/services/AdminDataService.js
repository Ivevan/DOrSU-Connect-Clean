// Simple in-memory Admin data service (JavaScript)
// Provides dashboard data and CRUD-like helpers for posts/updates

let postsStore = [
  {
    id: '7',
    title: 'Midterm Examination Schedule',
    description: 'Midterm examinations will be held from November 3-7, 2025. Please check the examination schedule posted on the bulletin board. Students must bring their ID cards.',
    category: 'Academic',
    date: 'Nov 3, 2025',
    isoDate: new Date(2025, 10, 3).toISOString(), // Nov 3, 2025 (Monday)
    images: [],
    image: undefined,
    isPinned: true,
    isUrgent: true,
    source: 'Admin',
  },
  {
    id: '8',
    title: 'Holiday Notice: All Saints Day',
    description: 'Classes will be suspended on November 1, 2025 in observance of All Saints Day. Regular classes will resume on November 3, 2025.',
    category: 'Announcement',
    date: 'Nov 3, 2025',
    isoDate: new Date(2025, 10, 3).toISOString(),
    images: [],
    image: undefined,
    isPinned: false,
    isUrgent: false,
    source: 'Admin',
  },
  {
    id: '9',
    title: 'Science Fair Registration Opens',
    description: 'Registration for the annual Science Fair is now open. Interested students can register at the Science Department office until November 8, 2025. Projects should showcase innovation and creativity.',
    category: 'Academic',
    date: 'Nov 5, 2025',
    isoDate: new Date(2025, 10, 5).toISOString(),
    images: [],
    image: undefined,
    isPinned: false,
    isUrgent: false,
    source: 'Admin',
  },
  {
    id: '16',
    title: 'Campus Career Fair 2025',
    description: 'Join us for the annual Campus Career Fair today from 9:00 AM to 4:00 PM at the Main Gymnasium. Meet with top employers, explore career opportunities, and network with industry professionals. Bring your resume and dress professionally!',
    category: 'Event',
    date: 'Nov 8, 2025',
    isoDate: new Date(2025, 10, 8).toISOString(), // Nov 8, 2025 (Saturday)
    images: [],
    image: undefined,
    isPinned: true,
    isUrgent: false,
    source: 'Admin',
  },
  {
    id: '10',
    title: 'Cultural Week Celebration',
    description: 'Join us for our annual Cultural Week celebration from November 10-14, 2025. Experience diverse cultural performances, food festivals, and art exhibitions. All students and faculty are welcome.',
    category: 'Event',
    date: 'Nov 10, 2025',
    isoDate: new Date(2025, 10, 10).toISOString(),
    images: [],
    image: undefined,
    isPinned: true,
    isUrgent: false,
    source: 'Admin',
  },
  {
    id: '11',
    title: 'Tuition Fee Payment Deadline',
    description: 'The deadline for second semester tuition fee payment is November 14, 2025. Please settle your accounts at the Finance Office to avoid late payment charges.',
    category: 'Academic',
    date: 'Nov 12, 2025',
    isoDate: new Date(2025, 10, 12).toISOString(),
    images: [],
    image: undefined,
    isPinned: false,
    isUrgent: true,
    source: 'Admin',
  },
  {
    id: '12',
    title: 'Sports Intramurals 2025',
    description: 'The annual Sports Intramurals will be held on November 18-22, 2025. All students are encouraged to participate. Registration forms are available at the PE Department.',
    category: 'Event',
    date: 'Nov 18, 2025',
    isoDate: new Date(2025, 10, 18).toISOString(),
    images: [],
    image: undefined,
    isPinned: true,
    isUrgent: false,
    source: 'Admin',
  },
  {
    id: '13',
    title: 'Library System Upgrade',
    description: 'The library system will undergo maintenance on November 20, 2025 from 2:00 PM to 6:00 PM. Online services will be temporarily unavailable during this period.',
    category: 'Announcement',
    date: 'Nov 20, 2025',
    isoDate: new Date(2025, 10, 20).toISOString(),
    images: [],
    image: undefined,
    isPinned: false,
    isUrgent: false,
    source: 'Admin',
  },
  {
    id: '14',
    title: 'Thanksgiving Break',
    description: 'Classes will be suspended from November 27-29, 2025 for the Thanksgiving break. Regular classes will resume on December 1, 2025. Have a safe and restful holiday!',
    category: 'Announcement',
    date: 'Nov 25, 2025',
    isoDate: new Date(2025, 10, 25).toISOString(),
    images: [],
    image: undefined,
    isPinned: true,
    isUrgent: false,
    source: 'Admin',
  },
  {
    id: '15',
    title: 'Final Project Submission Deadline',
    description: 'All final projects and research papers must be submitted on or before November 28, 2025. Late submissions will incur a grade deduction. Please coordinate with your respective professors.',
    category: 'Academic',
    date: 'Nov 26, 2025',
    isoDate: new Date(2025, 10, 26).toISOString(),
    images: [],
    image: undefined,
    isPinned: false,
    isUrgent: true,
    source: 'Admin',
  },
];
let idCounter = 17;

// Reduced delay for better performance - can be removed in production
const delay = (ms = __DEV__ ? 50 : 100) => new Promise(resolve => setTimeout(resolve, ms));

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



