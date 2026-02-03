import { Movie } from '../types';

export const mockMovies: Movie[] = [
  {
    id: 'pushpa-2',
    title: 'Pushpa 2: The Rule',
    language: 'Telugu',
    synopsis:
      'Pushpa returns to defend his empire as new political powers challenge his rise; the stakes escalate across the Seshachalam forests.',
    cast: [
      { name: 'Allu Arjun', role: 'Actor', character: 'Pushpa Raj' },
      { name: 'Rashmika Mandanna', role: 'Actor', character: 'Srivalli' },
      { name: 'Fahadh Faasil', role: 'Actor', character: 'SP Bhanwar Singh Shekhawat' }
    ],
    director: 'Sukumar',
    writers: ['Sukumar'],
    genres: ['Action', 'Thriller', 'Crime'],
    themes: ['Power', 'Smuggling', 'Underdog'],
    status: 'Upcoming',
    releaseDate: '2024-08-15',
    poster:
      'https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?auto=format&fit=crop&w=900&q=80',
    backdrop:
      'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=1400&q=80',
    songs: [
      {
        id: 'pushpa2-song1',
        title: 'Pushpa 2 Theme',
        singers: ['Devi Sri Prasad'],
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        platform: 'YouTube'
      }
    ],
    sources: ['Official teaser', 'Trade reports']
  },
  {
    id: 'jawan',
    title: 'Jawan',
    language: 'Hindi',
    synopsis:
      'A man driven by a personal vendetta partners with a fearless band of women to rectify societal wrongs while confronting his own past.',
    cast: [
      { name: 'Shah Rukh Khan', role: 'Actor', character: 'Vikram / Azaad' },
      { name: 'Nayanthara', role: 'Actor', character: 'Narmada' },
      { name: 'Vijay Sethupathi', role: 'Actor', character: 'Kalee' }
    ],
    director: 'Atlee',
    writers: ['Atlee', 'Sumit Arora'],
    genres: ['Action', 'Drama'],
    themes: ['Justice', 'Family', 'Patriotism'],
    status: 'Streaming',
    trailerUrl: 'https://www.youtube.com/watch?v=COv52Qyctws',
    ott: [
      { provider: 'Netflix', type: 'Streaming', url: 'https://www.netflix.com' },
      { provider: 'Prime Video', type: 'Rent', url: 'https://www.primevideo.com' }
    ],
    poster:
      'https://images.unsplash.com/photo-1497032205916-ac775f0649ae?auto=format&fit=crop&w=900&q=80',
    rating: 8.1,
    songs: [
      {
        id: 'jawan-song1',
        title: 'Chaleya',
        singers: ['Arijit Singh', 'Shilpa Rao'],
        youtubeUrl: 'https://www.youtube.com/watch?v=HrnrqYxYrbk',
        platform: 'YouTube',
        duration: '3:11'
      },
      {
        id: 'jawan-song2',
        title: 'Not Ramaiya Vastavaiya',
        singers: ['Anirudh Ravichander', 'Sreerama Chandra'],
        youtubeUrl: 'https://www.youtube.com/watch?v=4cVo80Yv1Yk',
        platform: 'YouTube',
        duration: '3:23'
      }
    ],
    sources: ['Public soundtrack', 'OTT listing']
  },
  {
    id: 'kalki-2898-ad',
    title: 'Kalki 2898 AD',
    language: 'Telugu',
    synopsis:
      'A futuristic reimagining of the Mahabharata where a mysterious warrior rises against oppressive regimes in a dystopian landscape.',
    cast: [
      { name: 'Prabhas', role: 'Actor', character: 'Bhairava' },
      { name: 'Amitabh Bachchan', role: 'Actor', character: 'Ashwatthama' },
      { name: 'Deepika Padukone', role: 'Actor' }
    ],
    director: 'Nag Ashwin',
    genres: ['Sci-Fi', 'Action', 'Mythology'],
    themes: ['Dystopia', 'Mythic future', 'Rebellion'],
    status: 'Upcoming',
    releaseDate: '2024-05-09',
    poster:
      'https://images.unsplash.com/photo-1517602302552-471fe67acf66?auto=format&fit=crop&w=900&q=80',
    backdrop:
      'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?auto=format&fit=crop&w=1400&q=80',
    songs: [],
    sources: ['Press releases', 'Producer announcements']
  },
  {
    id: '12th-fail',
    title: '12th Fail',
    language: 'Hindi',
    synopsis:
      'Based on a true story, a young man from a modest background battles systemic odds to crack the UPSC exams and redefine his destiny.',
    cast: [
      { name: 'Vikrant Massey', role: 'Actor', character: 'Manoj Kumar Sharma' },
      { name: 'Medha Shankar', role: 'Actor', character: 'Shraddha Joshi' }
    ],
    director: 'Vidhu Vinod Chopra',
    genres: ['Drama', 'Biography'],
    themes: ['Perseverance', 'Exams', 'Small town'],
    status: 'Streaming',
    poster:
      'https://images.unsplash.com/photo-1464375117522-1311d6a5b81f?auto=format&fit=crop&w=900&q=80',
    rating: 8.7,
    songs: [
      {
        id: '12thfail-song1',
        title: 'Restart',
        singers: ['Shreya Ghoshal'],
        youtubeUrl: 'https://www.youtube.com/watch?v=abcdefghi',
        platform: 'YouTube',
        duration: '3:05'
      }
    ],
    sources: ['OTT metadata']
  }
];
