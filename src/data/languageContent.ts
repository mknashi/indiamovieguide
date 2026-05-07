export type LanguageIntro = {
  headline: string;
  body: string[];
  streamingBody: string[];
};

export type LanguageColors = {
  bg: string;
  border: string;
  accent: string;
  industry: string;
};

export const LANGUAGE_INTROS: Record<string, LanguageIntro> = {
  Hindi: {
    headline: 'Bollywood & Hindi Cinema',
    body: [
      "Hindi cinema — popularly known as Bollywood — is produced primarily in Mumbai and is the most widely distributed Indian film industry in the world. With over a century of history, Hindi films have defined mainstream Indian popular culture: from the golden era of Dev Anand and Guru Dutt in the 1950s and 60s, to the masala blockbusters of the 70s and 80s, to the NRI romances of the 90s, and today's pan-India spectacles.",
      "Bollywood is known globally for its elaborate song-and-dance sequences, sweeping romances, and a storytelling style that blends action, drama, comedy, and emotion in a single film. Contemporary Hindi cinema spans a wide range — indie art films from directors like Anurag Kashyap and Dibakar Banerjee coexist with mega-budget franchises from studios like Yash Raj Films and Dharma Productions.",
      "Stars like Shah Rukh Khan, Aamir Khan, Salman Khan, and Deepika Padukone command audiences well beyond India. The rise of Netflix, Amazon Prime, and JioCinema has opened a new chapter of Hindi originals that sit alongside theatrical releases.",
    ],
    streamingBody: [
      "Hindi-language films dominate Indian OTT platforms, with every major service investing heavily in Bollywood content and originals. Netflix India has produced acclaimed series like Sacred Games and Scam 1992, while Amazon Prime Video has backed The Family Man and Mirzapur. JioCinema has secured theatrical premieres of major Bollywood releases, making it a first-stop destination for new Hindi films.",
      "Theatrical releases typically arrive on streaming within four to eight weeks of their cinema run. Disney+ Hotstar carries a strong Hindi library through its Star catalogue. ZEE5 and SonyLIV also offer extensive Hindi film archives alongside original series. Use the platform filters below to find what's currently streaming in Hindi.",
    ],
  },
  Tamil: {
    headline: 'Kollywood & Tamil Cinema',
    body: [
      "Tamil cinema, produced in Chennai and known as Kollywood, is one of India's oldest and most technically ambitious film industries. Tamil films balance spectacular commercial entertainers with a proud tradition of social realism — a duality stretching from the political dramas of M.G. Ramachandran's era to today's films from directors like Pa. Ranjith, Vetrimaaran, and Mani Ratnam.",
      "Kollywood is internationally recognized for its production scale: directors like Shankar have created films that rival Hollywood blockbusters in visual ambition, and composers like A.R. Rahman and Anirudh Ravichander have produced soundtracks that travel far beyond the cinema hall.",
      "Superstar Rajinikanth and Kamal Haasan remain cultural institutions, while the newer generation — Vijay, Vikram, Dhanush, Suriya — command massive global followings. Tamil cinema releases regularly receive international theatrical distribution, and streaming platforms have made Kollywood content accessible to Tamil diaspora worldwide.",
    ],
    streamingBody: [
      "Tamil cinema has a strong and competitive OTT presence. Sun NXT is the largest dedicated Tamil streaming platform, carrying an extensive back-catalog alongside new releases. Amazon Prime Video has been particularly aggressive in acquiring Tamil film rights — major titles like Vikram, Ponniyin Selvan, and Jai Bhim built enormous streaming audiences on the platform.",
      "Netflix, Disney+ Hotstar, and ZEE5 all carry Tamil theatrical releases, typically within four to six weeks of cinema. Several Tamil films have opted for direct OTT premieres, particularly mid-budget releases targeting specific genre audiences. Use the platform filters below to browse Tamil titles by streaming service.",
    ],
  },
  Telugu: {
    headline: 'Tollywood & Telugu Cinema',
    body: [
      "Telugu cinema, produced in Hyderabad, is India's largest film industry by box office revenue. Tollywood has delivered the most globally visible Indian blockbusters of recent years — from the RRR phenomenon directed by S.S. Rajamouli, to the Baahubali saga, to the Pushpa franchise starring Allu Arjun.",
      "These films broke into mainstream international consciousness in a way Indian regional cinema rarely had before, driven by massive production scale, kinetic action choreography, and emotionally direct storytelling. Telugu cinema has deep roots: the industry dates to the early 20th century and produced icons like N.T. Rama Rao and Akkineni Nageswara Rao whose influence extended far beyond film.",
      "Today's Tollywood is driven by stars like Prabhas, Ram Charan, Jr. NTR, Mahesh Babu, and Allu Arjun, alongside acclaimed directors like Trivikram Srinivas, Sukumar, and Koratala Siva. Dubbed versions of Telugu hits regularly top the charts in Hindi, Tamil, and other languages.",
    ],
    streamingBody: [
      "Telugu cinema's streaming landscape is one of the most competitive in India. Aha — a Telugu-focused OTT platform — offers the largest dedicated collection of Telugu films and originals. Amazon Prime Video, Netflix, and Disney+ Hotstar all bid aggressively for rights to major Tollywood releases, and pan-India blockbusters like RRR and Pushpa 2 drew record streaming numbers.",
      "Dubbed versions of Telugu hits on Hindi-language platforms frequently outperform their original-language streams, reflecting the wide national appetite for Tollywood content. Netflix has also invested in Telugu originals. Use the platform filters below to find Telugu titles by streaming service.",
    ],
  },
  Kannada: {
    headline: 'Sandalwood & Kannada Cinema',
    body: [
      "Kannada cinema, nicknamed Sandalwood and based in Bengaluru, is one of India's oldest film industries and has experienced a remarkable global breakout in recent years.",
      "The KGF franchise starring Yash put Sandalwood on the international map: KGF: Chapter 2 (2022) became one of the highest-grossing Indian films ever made, demonstrating that Kannada films could compete at the very highest commercial level. Beyond KGF, Rishab Shetty's Kantara — a mythological action thriller rooted in coastal Karnataka folk traditions — won widespread critical acclaim and became a global streaming hit.",
      "The industry has a strong literary and theatrical tradition, drawing from Kannada literature and folk heritage. Directors like Pawan Kumar and Raj B. Shetty have brought a distinct auteur voice to Sandalwood alongside its commercial mainstream. The industry's growing ambition is matched by an increasingly sophisticated, invested audience base inside and outside Karnataka.",
    ],
    streamingBody: [
      "Kannada cinema's OTT presence grew dramatically after the global breakout of KGF: Chapter 2 and Kantara, which introduced Sandalwood to streaming audiences worldwide. Amazon Prime Video and Netflix both carry major Kannada theatrical releases. Kantara in particular became a landmark streaming title, performing strongly across all language versions on Netflix.",
      "Zee Kannada and Sun NXT serve the Kannada back-catalog, while Aha has expanded into Kannada originals. The streaming rights market for Kannada films has become significantly more competitive since 2022. Use the platform filters below to browse currently available Kannada titles.",
    ],
  },
  Malayalam: {
    headline: 'Mollywood & Malayalam Cinema',
    body: [
      "Malayalam cinema, produced in Kerala and known as Mollywood, has earned a global reputation for storytelling quality that outweighs its modest production budgets. Unlike industries built around star-vehicle spectacles, Malayalam cinema frequently centers on everyday characters, realistic social situations, and morally complex narratives — a tradition stretching from the classics of Adoor Gopalakrishnan and K.G. George to today's diverse new wave.",
      "Directors like Lijo Jose Pellissery, Dileesh Pothan, Jeethu Joseph, and Aashiq Abu have brought remarkable creative energy and international recognition to the industry. Fahadh Faasil's acclaimed performances in films like Joji and Kumbalangi Nights introduced Mollywood to global streaming audiences.",
      "The industry takes creative risks on subject matter — crime thrillers, social dramas, psychological horror, and feminist stories emerge alongside commercial entertainers. Mohanlal and Mammootty remain beloved legends, while a new generation of actors and directors continues the tradition of thoughtful, human-scale filmmaking.",
    ],
    streamingBody: [
      "Malayalam cinema's OTT story is one of the most dramatic in Indian streaming. Netflix invested early and aggressively in Mollywood, bringing acclaimed titles like Joji, Drishyam 2, and Kumbalangi Nights to a global audience. This transformed Malayalam cinema's international profile and built a dedicated worldwide fan base. Several high-profile Malayalam films now choose OTT premieres over theatrical release.",
      "Amazon Prime Video and Disney+ Hotstar also carry Malayalam titles. The Malayalam theatrical window is shorter than other industries — often two to three weeks — so new releases reach streaming quickly. SonyLIV hosts Malayalam originals as well. Use the platform filters below to find what's currently streaming in Malayalam.",
    ],
  },
  Marathi: {
    headline: 'Marathi Cinema',
    body: [
      "Marathi cinema, based in Mumbai and Pune, is one of India's most respected regional industries, with a tradition of socially conscious storytelling and literary adaptation that stretches back to the 1930s.",
      "Marathi films consistently perform well at the National Film Awards and international festivals, with directors like Nagraj Manjule (Sairat, Fandry), Umesh Kulkarni (Vihir, Deool), and Sachin Kundalkar producing films that reach audiences well beyond Maharashtra. Sairat (2016) became a cultural phenomenon — a tragic love story that transcended language barriers and was later adapted into multiple languages.",
      "The industry benefits from a rich theatrical tradition and a literate, engaged audience. Recent years have brought strong performances from stars like Rinku Rajguru, Subodh Bhave, and Ankush Chaudhary. With streaming platforms investing more in Marathi originals, the industry's national reach continues to expand.",
    ],
    streamingBody: [
      "Marathi cinema is well represented across major Indian OTT platforms. ZEE5 and SonyLIV carry particularly strong Marathi libraries, reflecting their traditional links to Marathi broadcasting through Zee Marathi and Sony Marathi channels. Netflix and Amazon Prime Video also host acclaimed Marathi theatrical releases.",
      "Several notable Marathi films — particularly literary and festival-oriented titles — have chosen direct-to-OTT releases, reaching national audiences who would not have found them theatrically. Use the platform filters below to browse currently available Marathi titles.",
    ],
  },
  Bengali: {
    headline: 'Bengali Cinema',
    body: [
      "Bengali cinema carries one of the most storied traditions in all of Indian filmmaking. The West Bengal industry — centered in Kolkata — traces its legacy directly to Satyajit Ray, whose Apu Trilogy is considered among the greatest works of world cinema and introduced Indian art filmmaking to global audiences.",
      "Directors like Mrinal Sen, Ritwik Ghatak, and Tapan Sinha built a humanist, literary tradition that contemporary directors like Srijit Mukherji and Kaushik Ganguly honor while also making commercially successful films. Bengali cinema draws heavily from the literary wealth of Rabindranath Tagore and Sarat Chandra Chattopadhyay, alongside original genre films — crime thrillers, mythological dramas, and social comedies.",
      "Stars like Prosenjit Chatterjee, Dev, and the newer generation maintain strong connections with Bengali-speaking audiences globally. OTT platforms have given Bengali cinema new visibility far beyond West Bengal.",
    ],
    streamingBody: [
      "Bengali cinema has a dedicated OTT home in Hoichoi, a Bengali-focused streaming platform that carries the largest collection of Bengali films and originals, serving both Indian and Bangladeshi Bengali audiences worldwide. ZEE5 also carries Bengali content through its Zee Bangla ties.",
      "Netflix, Amazon Prime Video, and Disney+ Hotstar host recent critically acclaimed Bengali theatrical releases. The global Bengali diaspora — concentrated in the UK, USA, and the Middle East — is an active streaming audience, and platforms have begun investing in Bengali originals accordingly. Use the platform filters below to browse currently available Bengali titles.",
    ],
  },
  Punjabi: {
    headline: 'Punjabi Cinema',
    body: [
      "Punjabi cinema has undergone a remarkable commercial renaissance over the past decade and a half, transforming from a low-budget regional industry into a vibrant, internationally distributed film scene. The global Punjabi diaspora — concentrated in the UK, Canada, the United States, and Australia — provides a built-in international audience that supports theatrical releases outside India.",
      "Stars like Diljit Dosanjh, who has successfully crossed into Bollywood and international pop music, Gippy Grewal, Ammy Virk, and Sonam Bajwa have built strong fan bases that travel with films abroad. Punjabi films typically blend earthy rural humor with family drama, romance, and increasingly, action.",
      "The music in Punjabi films is often as commercially important as the screenplay itself, with song releases frequently going viral before the film opens. OTT platforms have given the industry a long tail beyond the theatrical window, making Punjabi films accessible to diaspora audiences on demand.",
    ],
    streamingBody: [
      "Punjabi films have a strong OTT presence driven by diaspora demand. Amazon Prime Video, Netflix, and ZEE5 carry Punjabi theatrical releases, typically within a few weeks of their cinema run. Some Punjabi films targeting diaspora audiences are released day-and-date on streaming alongside their theatrical debut in Punjab and international markets.",
      "The close relationship between Punjabi film music and viral pop culture means streaming platforms benefit from dual audiences — film viewers and music fans who discover films through their soundtracks. JioCinema and SonyLIV also carry Punjabi content. Use the platform filters below to browse currently available Punjabi titles.",
    ],
  },
};

export const LANGUAGE_COLORS: Record<string, LanguageColors> = {
  Hindi:     { bg: 'linear-gradient(135deg,rgba(234,88,12,0.22) 0%,rgba(251,146,60,0.10) 100%)',  border: 'rgba(234,88,12,0.45)',   accent: '#f97316', industry: 'Bollywood' },
  Tamil:     { bg: 'linear-gradient(135deg,rgba(220,38,38,0.22) 0%,rgba(248,113,113,0.10) 100%)', border: 'rgba(220,38,38,0.45)',   accent: '#ef4444', industry: 'Kollywood' },
  Telugu:    { bg: 'linear-gradient(135deg,rgba(37,99,235,0.22) 0%,rgba(96,165,250,0.10) 100%)',  border: 'rgba(37,99,235,0.45)',   accent: '#3b82f6', industry: 'Tollywood' },
  Kannada:   { bg: 'linear-gradient(135deg,rgba(22,163,74,0.22) 0%,rgba(74,222,128,0.10) 100%)',  border: 'rgba(22,163,74,0.45)',   accent: '#22c55e', industry: 'Sandalwood' },
  Malayalam: { bg: 'linear-gradient(135deg,rgba(6,182,212,0.22) 0%,rgba(103,232,249,0.10) 100%)', border: 'rgba(6,182,212,0.45)',   accent: '#06b6d4', industry: 'Mollywood' },
  Marathi:   { bg: 'linear-gradient(135deg,rgba(245,158,11,0.22) 0%,rgba(252,211,77,0.10) 100%)', border: 'rgba(245,158,11,0.45)',  accent: '#f59e0b', industry: 'Marathi Cinema' },
  Bengali:   { bg: 'linear-gradient(135deg,rgba(124,58,237,0.22) 0%,rgba(196,181,253,0.10) 100%)',border: 'rgba(124,58,237,0.45)',  accent: '#8b5cf6', industry: 'Bengali Cinema' },
  Punjabi:   { bg: 'linear-gradient(135deg,rgba(234,179,8,0.22) 0%,rgba(253,224,71,0.10) 100%)',  border: 'rgba(234,179,8,0.45)',   accent: '#eab308', industry: 'Punjabi Cinema' },
};
