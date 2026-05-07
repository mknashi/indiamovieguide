export type ArticleSection = {
  heading: string;
  body: string[];
};

export type Article = {
  slug: string;
  title: string;
  subtitle: string;
  industry: string;
  lang: string; // language key for poster fetching, e.g. 'Telugu', 'Malayalam', 'All'
  readingTime: string;
  publishedDate: string;
  intro: string;
  sections: ArticleSection[];
  mustWatch: { title: string; year: number; language: string; reason: string }[];
};

export const ARTICLES: Article[] = [
  {
    slug: 'kgf-sandalwood-revolution',
    title: 'KGF: The Film That Changed Sandalwood Forever',
    subtitle: 'How a Kannada crime epic became the biggest pan-India blockbuster of its era',
    industry: 'Sandalwood',
    lang: 'Kannada',
    readingTime: '7 min read',
    publishedDate: '2025-04-20',
    intro:
      'Kannada cinema had produced respected films for decades — literary adaptations, social dramas, films that won critical recognition without ever threatening the commercial dominance of Bollywood, Telugu, or Tamil. Then, in December 2018, KGF: Chapter 1 arrived and changed everything. Within months of its release, Yash was a pan-India star. Within four years, the franchise had produced one of the highest-grossing Indian films ever made. What happened in that interval is one of the most instructive stories in the history of Indian commercial cinema.',
    sections: [
      {
        heading: 'The Making of a Myth',
        body: [
          'Prashanth Neel conceived KGF not as a crime film in the conventional sense but as a mythology — a story about the making of a legend. Rocky is not a character who becomes famous; he is a character about whom a legend is being told, with the narrator\'s reverence built into the film\'s visual grammar from the very first shot. The voiceover, the slow-motion entries, the way other characters discuss Rocky before we see him do anything remarkable — all of this is designed to position the viewer inside the legend\'s logic rather than outside it watching events unfold.',
          'This is a crucial distinction. Most gangster films present their protagonist\'s rise as something we witness gradually; KGF presents it as something we are being told about by a future in which Rocky\'s greatness is already established fact. The film is retrospective by design, and that retrospection gives every scene a weight it would not otherwise carry. We are not watching a man become powerful. We are watching the events that made a legend.',
          'The visual language reinforces this: gold-tinted cinematography, deep shadows, a production design that makes the Kolar Gold Fields look like a mythological underworld rather than a historical mining settlement. Neel is not interested in documentary realism. He is interested in the grammar of myth, and he applies it with total commitment.',
        ],
      },
      {
        heading: 'Yash and the Birth of a Pan-India Star',
        body: [
          'Before KGF, Yash was a successful Kannada star with a passionate local fan base — but unknown outside the state. Prashanth Neel\'s direction gave him something Kannada cinema had never fully provided: a mythological scale that made his physical presence and natural charisma legible to audiences who had no prior relationship with him.',
          'The Rocky character is defined by a handful of repeated gestures and expressions rather than by psychological complexity. He tilts his head a specific way when threatened. He delivers his most important lines looking slightly past the camera. He moves through action sequences with a deliberate slowness that conveys absolute confidence. These are all choices Yash makes consistently, and they create a character who is recognisable from a distance — which is precisely what a pan-India star vehicle requires.',
          'Yash\'s fan base grew explosively after KGF\'s release in a way that is genuinely unusual for an actor working in a regional language for the first time. Fan clubs formed in states where Kannada cinema had no previous following. This is partly a consequence of the dubbing strategy — Hindi audiences who loved KGF experienced it in Hindi and were responding to Yash\'s screen presence, not to a Kannada star. But it is also a function of the character: Rocky is the kind of hero who travels across cultural contexts because he is built from universal mythological materials.',
        ],
      },
      {
        heading: 'The Pan-India Distribution Gamble',
        body: [
          'KGF\'s producers released the film simultaneously in Kannada, Telugu, Hindi, Tamil, and Malayalam — a then-unusual move that required significant investment in dubbing and separate marketing campaigns. Hindi distribution for Kannada films was virtually nonexistent at the time. The producers were making a bet that the film was good enough, and commercially distinctive enough, to find audiences outside its home market even without an established distribution relationship.',
          'The bet paid off, though not immediately in the way its makers hoped. The initial Hindi release was modest. What drove KGF\'s Hindi success was organic word-of-mouth — viewers who had seen the Kannada or Telugu version recommending it to friends, social media clips of the action sequences circulating independently of the marketing campaign, and a gradual build in streaming numbers after the film left theatres.',
          'By the time KGF: Chapter 2 was in production, the landscape had completely changed. The second film had genuine pan-India marketing infrastructure, a pre-sold audience in every major market, and the kind of opening-day buzz that only the biggest Bollywood and Telugu films had previously generated.',
        ],
      },
      {
        heading: 'Chapter 2 and the Records',
        body: [
          'KGF: Chapter 2 (2022) arrived with the entire pan-India audience that the first film had built. Its opening weekend broke records held by Bollywood blockbusters including Baahubali 2. It became one of the highest-grossing Indian films ever made, earning over ₹1,200 crore at the Indian box office — a figure that would have been unimaginable for a Kannada film five years earlier.',
          'The second film also introduced Sanjay Dutt as the antagonist Adheera — a casting choice that signalled the franchise\'s aspirations. Bringing a Bollywood star of Dutt\'s generation and stature into a Kannada production reversed the historical direction of such crossovers: usually, regional stars moved to Bollywood in search of larger audiences. KGF brought the Bollywood name to Kannada.',
          'Chapter 2\'s success demonstrated something that the industry had theorised but not yet proven: that the KGF brand, not just the first film\'s word-of-mouth, was a genuine box office asset. Audiences who had loved Chapter 1 showed up for Chapter 2 not out of curiosity but out of loyalty — which is the defining characteristic of a franchise rather than a hit.',
        ],
      },
      {
        heading: 'Legacy for Sandalwood',
        body: [
          'The KGF phenomenon fundamentally changed what Kannada cinema believed was possible for itself. The industry that had once existed in the shadow of its neighbours now had one of the biggest film franchises in Indian cinema history. Kantara followed in 2022 with a completely different kind of Sandalwood success — quieter, more rooted in folk tradition, but equally global in its eventual reach.',
          'The KGF model has been studied and partially imitated by other regional industries looking to build pan-India audiences. Its lessons are clear: the mythological scale of the hero matters more than narrative complexity; the simultaneous multi-language release is essential rather than optional; and the first film\'s quality and distinctive identity are more important than any marketing campaign in building the audience for the sequel.',
          'For viewers encountering Sandalwood for the first time through KGF, the franchise is often the beginning of a longer journey. The industry has films that are nothing like KGF — intimate, realistic, literary — and discovering them after the franchise has primed an interest in Kannada cinema is one of the unexpected gifts the films have given to Indian cinema culture.',
        ],
      },
    ],
    mustWatch: [
      { title: 'KGF: Chapter 1', year: 2018, language: 'Kannada', reason: 'The origin. Watch the Hindi or Telugu dub if you\'re coming from outside Karnataka.' },
      { title: 'KGF: Chapter 2', year: 2022, language: 'Kannada', reason: 'Record-breaking sequel. Bigger scale, longer runtime, Sanjay Dutt as villain.' },
      { title: 'Ulidavaru Kandanthe', year: 2014, language: 'Kannada', reason: 'The pre-KGF Kannada film that showed the ambition was always there.' },
      { title: 'Kantara', year: 2022, language: 'Kannada', reason: 'A completely different kind of Sandalwood blockbuster — folk-mythological, deeply local, globally resonant.' },
      { title: 'Vikrant Rona', year: 2022, language: 'Kannada', reason: 'Kichcha Sudeep\'s supernatural thriller — proof that KGF expanded the ambition of the whole industry.' },
    ],
  },
  {
    slug: 'kantara-karnataka-folk-traditions',
    title: "Kantara and Karnataka's Living Folk Traditions",
    subtitle: 'How a Tulu Nadu folk-mythology film became a global streaming phenomenon',
    industry: 'Sandalwood',
    lang: 'Kannada',
    readingTime: '8 min read',
    publishedDate: '2025-04-05',
    intro:
      "When Kantara released in October 2022, it found immediate success in Karnataka before Netflix's global platform amplified it into something much larger. The film trended worldwide, introduced millions of viewers to Tulu Nadu and its ancient folk traditions, and generated a conversation about Indian folk cinema that is still ongoing. Understanding Kantara requires understanding the culture it depicts — and understanding why director Rishab Shetty chose to depict it with the specific fidelity that he did.",
    sections: [
      {
        heading: 'Rishab Shetty and Tulu Nadu',
        body: [
          "Director and lead actor Rishab Shetty grew up in Kundapura, a coastal town in Karnataka's Udupi district — the heart of Tulu Nadu, the cultural region along the southwestern Karnataka coast where the Tulu language and its ancient folk traditions have been preserved for centuries. The Bhoota Kola ritual — in which a dancer becomes temporarily possessed by a spirit ancestor and serves as an intermediary between the divine and human worlds — is not an exotic curiosity to Shetty. It is the living religious practice of the community he comes from.",
          'This origin is the key to understanding why Kantara works as a film. Shetty is not depicting a folk tradition for the curiosity of an urban audience who has never encountered it. He is depicting it for himself and for the communities of coastal Karnataka who already know it — and the confidence that comes from that position of insider knowledge is evident in every decision the film makes about how to show the ritual on screen.',
          "Shetty spent years researching the film, consulting with practitioners of the Bhoota Kola tradition, and building relationships with the communities whose traditions he was depicting. The film's non-professional cast includes actual Bhoota Kola performers. The ritual sequences use authentic costume elements, authentic musical instruments, and an aesthetic language developed in close collaboration with the community.",
        ],
      },
      {
        heading: 'The Bhoota Kola and Why It Works on Screen',
        body: [
          'The Bhoota Kola sequences in Kantara are filmed and edited very differently from the rest of the film. The camera becomes more mobile, the editing rhythm changes, the colour palette shifts. Shetty is not simply depicting a ritual; he is trying to convey what the ritual feels like from inside its own logic — the point at which performance and genuine spiritual experience become indistinguishable from each other.',
          "This distinction matters because it is what separates Kantara from the long tradition of Indian films that have depicted folk rituals as spectacle for an urban audience's consumption. Shetty's treatment is respectful not because it avoids complexity but because it takes the ritual's internal logic seriously. The Bhoota Kola is not presented as something strange or exotic. It is presented as something true — and the film's emotional power comes from the conviction with which that truth is asserted.",
          "The climactic sequence, in which Shetty's character Shiva undergoes a transformation that collapses the boundary between the human and divine, is the most discussed scene in recent Indian cinema for good reason. It is genuinely unprecedented in mainstream Indian filmmaking: a sequence that asks the audience to accept the literal reality of possession as a fact within the film's world, and that achieves this through performance, choreography, and cinematography rather than through CGI spectacle.",
        ],
      },
      {
        heading: 'The Land Rights Story',
        body: [
          'Beneath the folk mythology, Kantara is a film about land — specifically about the ongoing conflict between communities that have lived in specific landscapes for generations and the forces that seek to displace them. A forest officer arrives to enforce regulations that would restrict the community\'s access to land they have occupied for centuries. A wealthy landlord has his own claims. The community\'s relationship to the land is inseparable from their religious relationship to the spirit ancestors who are tied to it.',
          'This is not a new theme in Indian cinema, but Kantara\'s handling of it is unusual: the land rights story is inseparable from the spiritual story, because the community\'s claim to the land is itself spiritual rather than merely economic or historical. The Bhoota\'s guarantee is the foundation of the community\'s title. Remove the religious dimension and the political argument collapses. This integration of the spiritual and the political is what gives the film its structural integrity.',
          "The land rights dimension also connects Kantara to a much larger conversation about indigenous land rights, forest communities, and state power in contemporary India. The film's success brought attention to real conflicts between tribal and forest-dwelling communities and government forest departments — conflicts that have been ongoing for decades but have received little mainstream media coverage.",
        ],
      },
      {
        heading: 'Global Impact',
        body: [
          "Netflix's decision to platform Kantara globally was not initially anticipated to produce such remarkable results. The film's language — Kannada, with substantial Tulu dialogue — its folk-mythology subject matter, and its Karnataka-specific cultural references are not the obvious ingredients of international crossover. The subtitled version requires viewers to engage with unfamiliar cultural material without the familiar anchors of star power or genre.",
          'What happened instead was that the film\'s emotional intensity — particularly the climactic Bhoota Kola sequence — proved genuinely universal. The experience of watching something spiritually overwhelming is available to viewers who know nothing about Tulu Nadu. The sequence works because the film has spent ninety minutes establishing the internal logic of its world; by the climax, even viewers completely unfamiliar with the tradition understand what is at stake.',
          "Kantara trended globally on Netflix in the weeks following its release. It was reviewed in publications that rarely cover Indian cinema. It introduced hundreds of thousands of international viewers to Karnataka's coastal culture — and, by extension, to the existence of regional Indian film industries beyond the ones that had already achieved international visibility.",
        ],
      },
      {
        heading: "What Kantara Means for Indian Folk Cinema",
        body: [
          "Kantara's success has created a template and a conversation. The template: that authentic engagement with a living folk tradition, combined with commercial entertainment structure, can reach audiences far beyond the community whose tradition is being depicted. The conversation: which folk traditions has Indian cinema overlooked? Which communities have stories, rituals, and ways of understanding the world that mainstream audiences would respond to if given the opportunity?",
          "The answers to these questions are numerous. India has thousands of living folk traditions, most of which have never been depicted on film with anything approaching the seriousness and fidelity that Shetty brought to the Bhoota Kola. Several films in production since Kantara have attempted to engage with other traditions — Chhattisgarhi folk rituals, Manipuri martial arts traditions, Rajasthani puppet theatre — with varying degrees of authenticity.",
          "Kantara itself is not finished. Shetty has announced a prequel set in an earlier historical period, which will explore the origins of the Bhoota whose story the first film depicts. Whether that film will achieve what Kantara achieved is an open question. What is not open is the question of whether Kantara has permanently changed the conversation about what Indian cinema can be — it clearly has.",
        ],
      },
    ],
    mustWatch: [
      { title: 'Kantara', year: 2022, language: 'Kannada', reason: 'The film itself. Watch it with subtitles, not dubbed — the Tulu dialogue matters.' },
      { title: 'KGF: Chapter 1', year: 2018, language: 'Kannada', reason: 'The other Sandalwood revolution from the same era. A very different kind of blockbuster.' },
      { title: 'Lucia', year: 2013, language: 'Kannada', reason: 'The crowd-funded art film that signalled Kannada cinema\'s new ambition before KGF arrived.' },
      { title: 'Ulidavaru Kandanthe', year: 2014, language: 'Kannada', reason: 'Rakshit Shetty\'s neo-noir — a film that established a new generation\'s artistic credentials.' },
    ],
  },
  {
    slug: 'telugu-pan-india-revolution',
    title: 'The Pan-India Revolution: How Telugu Cinema Transformed Indian Film',
    subtitle: 'From Baahubali to RRR — how Tollywood rewrote the rules of Indian blockbusters',
    industry: 'Tollywood',
    lang: 'Telugu',
    readingTime: '8 min read',
    publishedDate: '2025-03-01',
    intro:
      'For most of the twentieth century, Indian cinema meant Bollywood. Hindi films dominated national conversation, controlled the widest theatrical distribution network, and produced the stars who became the pan-Indian faces of the country\'s film culture. Telugu cinema — Tollywood — was a respected regional industry with its own devoted audience, but its reach rarely extended far beyond Andhra Pradesh and Telangana. That changed with extraordinary speed between 2015 and 2023, when a sequence of Telugu films rewrote the rules of Indian cinema entirely.',
    sections: [
      {
        heading: 'The Baahubali Moment',
        body: [
          'S. S. Rajamouli\'s Baahubali: The Beginning (2015) is the most consequential Indian film since the sound era. Not because it was the first Indian film to attempt Hollywood-scale production values — several had tried before — but because it was the first to succeed on every level simultaneously: visual effects that genuinely competed with international productions, a mythological world built with internal consistency and emotional depth, and a cliffhanger ending so perfectly calibrated that it generated two years of national conversation.',
          'The question "Why did Kattappa kill Baahubali?" became a genuine cultural phenomenon. It was discussed in newspapers, debated at family dinners, and speculated about across social media. When Baahubali 2: The Conclusion arrived in 2017 and finally answered the question, it became the highest-grossing Indian film ever made at that time — breaking records held by Bollywood blockbusters and demonstrating that a Telugu film could command the entire Indian market on its own terms.',
          'What Baahubali established was not just a box office record, but a new benchmark for ambition. Telugu producers and directors took note: the audience for a well-made Telugu film was not the Telugu-speaking market. It was all of India.',
        ],
      },
      {
        heading: 'The Pan-India Strategy',
        body: [
          'The term "pan-India film" entered common usage around 2020, but the strategy it describes predates it. A pan-India film is produced simultaneously in multiple languages — typically Telugu, Tamil, Hindi, Kannada, and Malayalam — with equal emphasis on marketing and distribution in each market. It is not a dubbed film; it is conceived from the outset to be a national product.',
          'This approach requires significantly larger budgets, more complex production logistics, and marketing campaigns that must resonate with audiences who have completely different cultural references. The risks are correspondingly higher. But so are the rewards. When Pushpa: The Rise released in 2021, Allu Arjun\'s portrayal of a swaggering red sandalwood smuggler generated a level of cultural penetration across India that most Bollywood stars could not achieve in their home market.',
          'The Pushpa phenomenon was partly about the film itself and partly about the moment. Streaming had democratised access to regional cinema in a way that theatrical distribution never had. Audiences across India had been discovering Telugu, Tamil, and Malayalam films on Netflix and Amazon Prime for several years; when Pushpa arrived with that audience already primed, it landed differently than a dubbed regional film would have five years earlier.',
        ],
      },
      {
        heading: 'RRR and Global Recognition',
        body: [
          'S. S. Rajamouli\'s RRR (2022) completed what Baahubali had started. A historical fantasy pairing Ram Charan and Jr. NTR as fictional versions of real Indian freedom fighters, RRR was designed as a spectacle for the global age: a film that could be watched with no knowledge of Indian history and still function as a perfectly satisfying action epic.',
          'The Naatu Naatu sequence — a competitive dance contest staged in the rain outside a British colonial mansion — won the Academy Award for Best Original Song. It was the first Indian film song to win an Oscar, and its victory was accompanied by a live performance at the ceremony that introduced the film to an audience far beyond Indian cinema\'s existing international following.',
          'The Oscar was a validation but not the cause of RRR\'s global success. The film had already built a devoted audience in Japan, where it ran in cinemas for over a year; in the United States, where it found enthusiastic reception among non-Indian audiences unfamiliar with its stars; and across Southeast Asia, where Rajamouli\'s visual grammar resonated with audiences who had grown up on action cinema from multiple traditions.',
        ],
      },
      {
        heading: 'What Makes Telugu Blockbusters Different',
        body: [
          'The Telugu blockbuster has a distinct visual and emotional language that separates it from the Bollywood films it has partly displaced from the top of the Indian box office. Where Hindi commercial cinema tends toward intimate melodrama punctuated by spectacle, Telugu blockbusters are built entirely around momentum — every scene exists to escalate either the emotional stakes or the action, and the two are rarely separated.',
          'The hero in a Telugu blockbuster occupies a different moral and physical universe from ordinary humans. He is not aspirationally relatable in the way of a Bollywood everyman hero; he is aspirationally impossible. Ram Charan throwing a chain across a bridge in RRR, Prabhas wielding a waterfall in Baahubali, Allu Arjun walking through fire in Pushpa — these are not realistic action sequences. They are mythological acts dressed in contemporary clothes.',
          'This mythological scale is also what has made Telugu blockbusters so legible to international audiences who have grown up on Marvel and DC. The heroes\' powers may not be supernatural, but their visual grammar is. Telugu cinema accidentally discovered that the epic emotional register it had always operated in was perfectly matched to the global action-cinema moment.',
        ],
      },
      {
        heading: 'The Directors Behind the Revolution',
        body: [
          'S. S. Rajamouli is the most internationally famous, but he is not the only architect of Telugu cinema\'s transformation. Sukumar, who directed Pushpa, works in a grittier register — his films are rooted in the specific geography and social dynamics of Andhra Pradesh and Telangana, but his eye for character and his understanding of how to build a star persona across a film make his work travel further than its regional specificity might suggest.',
          'Trivikram Srinivas occupies a different position entirely: a screenwriter-director whose films are built on dialogue that Telugu audiences can quote verbatim. His 2020 film Ala Vaikuntapuramulo broke Tamil Nadu box office records — an extraordinary achievement for a Telugu film — not through spectacle but through the emotional precision of its writing.',
          'The revolution has also produced a new generation of producers willing to stake enormous budgets on Telugu-language projects. The Geetha Arts banner, DVV Entertainment, and others have demonstrated that Telugu films can carry budgets that previously only Bollywood studios would contemplate.',
        ],
      },
    ],
    mustWatch: [
      { title: 'Baahubali: The Beginning', year: 2015, language: 'Telugu', reason: 'The film that started the revolution. Essential viewing.' },
      { title: 'RRR', year: 2022, language: 'Telugu', reason: 'Rajamouli\'s global masterpiece. The Naatu Naatu sequence is worth the watch alone.' },
      { title: 'Pushpa: The Rise', year: 2021, language: 'Telugu', reason: 'Allu Arjun at the peak of his screen charisma. A character-defining performance.' },
      { title: 'Ala Vaikuntapuramulo', year: 2020, language: 'Telugu', reason: 'Trivikram\'s writing at its most precise. The film that crossed Tamil Nadu.' },
      { title: 'Magadheera', year: 2009, language: 'Telugu', reason: 'The pre-Baahubali proof of concept. Ram Charan\'s debut is still stunning.' },
    ],
  },
  {
    slug: 'malayalam-cinema-golden-decade',
    title: "Malayalam Cinema's Golden Decade: How Mollywood Reinvented Itself",
    subtitle: 'The quiet revolution that made Kerala the most admired film industry in India',
    industry: 'Mollywood',
    lang: 'Malayalam',
    readingTime: '7 min read',
    publishedDate: '2025-02-15',
    intro:
      'Between 2013 and 2023, Malayalam cinema underwent one of the most remarkable creative transformations in Indian film history. An industry that had struggled commercially and artistically for much of the 2000s emerged as the most critically admired film industry in India — producing a run of films that consistently outperformed their budgets, won national awards, and earned the kind of international critical attention previously reserved for Indian art cinema.',
    sections: [
      {
        heading: 'The Death of the Star System',
        body: [
          'Malayalam cinema in the 1990s and 2000s ran on a familiar logic: a small number of superstar actors — Mohanlal, Mammootty, and a handful of others — were the guarantors of commercial viability. Films were built around these stars\' personas rather than around stories. The star\'s presence was the pitch; the script was secondary.',
          'This system collapsed gradually but definitively during the 2010s. The reasons were partly generational — audiences who had grown up with satellite television and later streaming were less susceptible to pure star power — and partly economic. Malayalam films had much smaller budgets than their Tamil or Telugu counterparts, which meant that paying a superstar fee left little money for production quality.',
          'What replaced the star system was a screenwriting-driven approach to commercial cinema. Films like Drishyam (2013) and Premam (2015) proved that a Malayalam film built on a genuinely excellent script could outperform anything a star-driven vehicle could achieve. The stars noticed. Mohanlal and Mammootty both pivoted toward appearing in script-driven films — which, paradoxically, restored their box office power because the films they were appearing in were actually good.',
        ],
      },
      {
        heading: 'The New Directors',
        body: [
          'The creative engine of Malayalam cinema\'s renaissance has been a generation of directors who came of age watching international cinema and approached storytelling with a comparative framework their predecessors lacked. Aashiq Abu, Lijo Jose Pellissery, Dileesh Pothan, and Jeethu Joseph each represent a different strand of the new Malayalam cinema.',
          'Lijo Jose Pellissery is perhaps the most distinctive voice: a director whose films resist easy categorisation, operating somewhere between extreme social realism and genre abstraction. His Jallikattu (2019) is not really a thriller or an action film; it is a study of how quickly civilisation dissolves under pressure, staged as a visceral, documentary-like chase through a Kerala village.',
          'Dileesh Pothan\'s Maheshinte Prathikaaram (2016) announced a new kind of Kerala realism: unhurried, precisely observed, built from performances that felt improvised even when they were not. His follow-up Thondimuthalum Driksakshiyum (2017) is a masterwork of slow-burn procedural drama that proved the Malayalam audience had the patience for genuinely adult storytelling.',
        ],
      },
      {
        heading: 'Fahadh Faasil and the New Actor',
        body: [
          'If the new Malayalam cinema has a single figure who embodies its values most completely, it is Fahadh Faasil. The son of a filmmaker, Fahadh spent the early part of his career in unremarkable commercial films before finding his voice in a series of character-driven roles that demonstrated a range and intelligence with few parallels in Indian cinema.',
          'His performance in Maheshinte Prathikaaram established him as the defining actor of the new Malayalam cinema: a performer capable of conveying enormous interior life through restraint. His subsequent films — Thondimuthalum Driksakshiyum, Super Deluxe (in Tamil), Joji, Malik — each found a different register, but all shared a commitment to psychological authenticity over conventional heroism.',
          'Fahadh\'s international breakthrough came through Netflix\'s global platforming of Joji (2021), in which he plays a youngest son driven to murder by frustrated ambition — a performance of genuine chilling force.',
        ],
      },
      {
        heading: 'The Thriller Tradition',
        body: [
          'Malayalam cinema\'s most consistent contribution to Indian film culture over the past decade has been in the crime thriller. The Drishyam films established a template: a domestic thriller with no action sequences, no songs, and no conventional heroism, in which the drama comes entirely from the collision of ordinary people with extraordinary circumstances.',
          'What separates Malayalam thrillers from their counterparts in other Indian industries is their commitment to psychological realism. A Malayalam thriller villain is not a colourful monster; he is a frightened man making bad decisions under pressure. The detective is not a brilliant eccentric; she is a competent professional doing a difficult job.',
          'The international streaming success of these films has created a new audience that approaches Malayalam cinema specifically looking for this quality of storytelling. This feedback loop — in which international recognition generates domestic prestige which attracts better scripts — has helped sustain the golden decade past the point where such streaks typically end.',
        ],
      },
    ],
    mustWatch: [
      { title: 'Drishyam', year: 2013, language: 'Malayalam', reason: 'The film that reset expectations for Indian crime writing.' },
      { title: 'Joji', year: 2021, language: 'Malayalam', reason: 'Fahadh Faasil\'s most internationally recognised performance.' },
      { title: 'Jallikattu', year: 2019, language: 'Malayalam', reason: 'Lijo Jose Pellissery at his most viscerally inventive.' },
      { title: 'Thondimuthalum Driksakshiyum', year: 2017, language: 'Malayalam', reason: 'The purest example of the new Kerala realism.' },
      { title: 'Malik', year: 2021, language: 'Malayalam', reason: 'An epic political thriller with Fahadh Faasil in commanding form.' },
    ],
  },
  {
    slug: 'first-timer-guide-tamil-cinema',
    title: "A First-Timer's Complete Guide to Tamil Cinema",
    subtitle: 'Stars, directors, genres, and where to begin in Kollywood',
    industry: 'Kollywood',
    lang: 'Tamil',
    readingTime: '9 min read',
    publishedDate: '2025-01-20',
    intro:
      'Tamil cinema — known as Kollywood, after Kodambakkam, the Chennai neighbourhood where many studios are based — produces around 250 films a year and supports one of the most passionately engaged film cultures in the world. Tamil film fans are known for the intensity of their devotion, the speed of their critical judgment, and the ritual significance they attach to their stars\' screen presence. For a first-time viewer, entering Kollywood can feel like arriving in the middle of a long, deeply personal conversation with no introduction. This guide is that introduction.',
    sections: [
      {
        heading: 'The Star System and Fan Culture',
        body: [
          'Tamil cinema\'s biggest stars — Rajinikanth, Kamal Haasan, Vijay, Ajith Kumar, Suriya — occupy a cultural position with no precise equivalent in Western film culture. They are closer to deities than to celebrities. Their images appear in temples; their birthdays are public celebrations; their films\' first-day-first-show screenings are religious events in which fans bathe statues of their idol before entering the cinema.',
          'This is not mere hyperbole. Rajinikanth, who has been making films since the mid-1970s, commands a following so devoted that his on-screen arrivals in theatrical settings generate the kind of noise that makes conversation impossible. The experience of watching a Rajini film in a Tamil cinema is genuinely unlike watching a film anywhere else in the world — it is closer to a concert or a sporting event, with the audience actively participating in every scene.',
          'Understanding this fan culture is not a prerequisite for enjoying Tamil films, but it helps explain why certain narrative conventions — the hero withstanding multiple blows, the villain\'s elaborate villainy, the songs that punctuate action sequences — make perfect sense in context. Tamil commercial cinema is a ritual in which the hero\'s triumph is as certain as sunrise, and what matters is the quality and style of that triumph.',
        ],
      },
      {
        heading: 'The Two Tamils: Mass and Class',
        body: [
          'Tamil cinema divides roughly between "mass" films — big-budget star vehicles aimed at the widest possible audience — and "class" films — smaller, more artistically ambitious productions that earn critical respect and national awards. The interesting thing about Kollywood is that these categories are less sealed than they might appear.',
          'Directors like Lokesh Kanagaraj and Pa. Ranjith operate in a space where mass entertainment and serious filmmaking overlap. Kanagaraj\'s Kaithi (2019) is a lean, relentless action film — no songs, no romance, just ninety minutes of brilliantly sustained tension — that was also a genuine commercial success. Pa. Ranjith\'s Sarpatta Parambarai (2021) is an explicitly political film about caste and identity set in 1970s Chennai, and it has found audiences far beyond the art-house circuit.',
          'The most interesting contemporary Tamil films refuse this division: Jai Bhim (2021), which dramatises a true story of police brutality against a tribal community, was a mainstream commercial release with a star at its centre, and it became one of Amazon Prime Video\'s most-watched Indian films globally.',
        ],
      },
      {
        heading: 'Key Directors to Know',
        body: [
          'Mani Ratnam is the indispensable figure in Tamil cinema\'s international reputation. His films from the late 1980s through the 2000s — Nayakan, Roja, Bombay, Dil Se, Alaipayuthey — defined what ambitious commercial Tamil cinema could look like, and his recent Ponniyin Selvan adaptation demonstrated that he remains at the peak of his craft after four decades.',
          'Vetrimaaran is the most serious of the current generation. His crime epics — Aadukalam, Vada Chennai — are dense, politically conscious, and built for rewatching. Thiagarajan Kumararaja, who has made only two films (Super Deluxe and Aaranya Kaandam), operates in a register closer to international art cinema: structurally adventurous, tonally unpredictable.',
          'Lokesh Kanagaraj has become the most commercially exciting director of the current generation. His "Lokesh Cinematic Universe" — a loose franchise connecting several of his films — has generated genuine excitement, and his ability to deliver action sequences of genuine craft while maintaining narrative coherence puts him in a small class of directors internationally.',
        ],
      },
      {
        heading: 'Where to Start',
        body: [
          'The best entry point depends on what kind of films you usually enjoy. If you want to understand the pure pleasure of Tamil mass cinema, start with Vikram (2022): Kamal Haasan\'s return to action filmmaking is perfectly calibrated to welcome a new audience while rewarding long-time fans.',
          'If you want to understand why Tamil cinema has earned such high critical regard internationally, start with Super Deluxe (2019): Thiagarajan Kumararaja\'s film is one of the most genuinely surprising Indian films of the past decade — structurally audacious and emotionally unpredictable in ways that most mainstream cinema cannot match.',
          'If you want to understand the social and political dimensions of Tamil cinema, Jai Bhim is the most accessible and powerful entry point available on streaming. Pariyerum Perumal (2018) is a deeper cut that rewards patience with one of the most honest portrayals of caste dynamics in Indian cinema.',
        ],
      },
    ],
    mustWatch: [
      { title: 'Vikram', year: 2022, language: 'Tamil', reason: 'The perfect entry point to contemporary Kollywood.' },
      { title: 'Super Deluxe', year: 2019, language: 'Tamil', reason: 'The most adventurous Tamil film of the past decade.' },
      { title: 'Jai Bhim', year: 2021, language: 'Tamil', reason: 'Tamil cinema\'s most important social film. Devastating and essential.' },
      { title: 'Kaithi', year: 2019, language: 'Tamil', reason: 'A masterclass in sustained tension. No songs, no romance. Just craft.' },
      { title: 'Ponniyin Selvan: Part 1', year: 2022, language: 'Tamil', reason: 'Mani Ratnam\'s epic period film. Tamil cinema at its most visually ambitious.' },
    ],
  },
  {
    slug: 'bollywood-masala-to-multiplex',
    title: 'Bollywood at the Crossroads: From Masala Films to the Multiplex Age',
    subtitle: 'How Hindi cinema transformed its storytelling across four pivotal decades',
    industry: 'Bollywood',
    lang: 'Hindi',
    readingTime: '8 min read',
    publishedDate: '2025-01-05',
    intro:
      'Hindi cinema — Bollywood — is one of the world\'s most prolific and culturally influential film industries, producing over 250 films per year and reaching audiences across India, South Asia, the Middle East, Africa, and the Indian diaspora worldwide. Understanding Bollywood requires understanding that it is not a single tradition but a sequence of them — each era\'s defining films shaped by the economic conditions, social anxieties, and technological possibilities of their moment.',
    sections: [
      {
        heading: 'The Masala Era: 1970s–1980s',
        body: [
          'The masala film — named for the spice mix that combines multiple flavours in a single preparation — is the defining achievement of Hindi commercial cinema. Developed to its fullest expression in the 1970s, the masala film combines action, romance, comedy, drama, and song in a single two-to-three-hour entertainment designed to satisfy every member of an audience simultaneously.',
          'The great masala films — Sholay (1975), Deewar (1975), Amar Akbar Anthony (1977) — were built around Amitabh Bachchan, whose screen persona as the Angry Young Man gave the era its emotional centre. Bachchan\'s characters were poor, frequently criminal, and defined by their resentment of a social system that had failed them. The screenwriting partnership of Salim Khan and Javed Akhtar created the template, and Ramesh Sippy\'s direction of Sholay remains the most culturally embedded Indian film ever made.',
        ],
      },
      {
        heading: 'The NRI Romance: 1990s',
        body: [
          'The 1990s brought economic liberalisation to India and a new kind of Hindi cinema to match. As the middle class expanded and the Indian diaspora became more economically significant, Bollywood discovered a new audience: educated, aspirationally Western, and hungry for films that reflected their values while affirming their Indian identity.',
          'Dilwale Dulhania Le Jayenge (1995) — DDLJ — is the era\'s defining text. Shah Rukh Khan and Kajol\'s chemistry, the film\'s validation of arranged-marriage customs within a framework of romantic love, and its gorgeous European locations created a template that Bollywood followed for fifteen years. DDLJ ran continuously in Mumbai\'s Maratha Mandir cinema for over 25 years.',
        ],
      },
      {
        heading: 'The Multiplex Revolution: 2000s',
        body: [
          'The opening of multiplex cinema chains across Indian cities in the early 2000s transformed Bollywood\'s economics and its stories. Multiplexes could programme smaller films profitably — because their higher ticket prices meant a small audience could make a film commercially viable. This created space for a kind of Hindi film that had never existed before: intimate, realistic, adult-oriented, and unbeholden to masala conventions.',
          'Anurag Kashyap, who had been writing sharp, dark scripts for years, emerged as the defining voice of the new Hindi cinema. Gangs of Wasseypur (2012) — a five-hour, two-part crime epic — was his masterwork: a film that demonstrated that Hindi cinema could sustain the kind of sprawling, literary crime storytelling previously associated only with prestige American television.',
        ],
      },
      {
        heading: 'The OTT Era and What Comes Next',
        body: [
          'The arrival of Netflix, Amazon Prime Video, and domestic platforms like JioCinema has fragmented Bollywood\'s audience in ways the industry is still working out. The theatrical box office — already disrupted by COVID-19\'s eighteen-month closure — has recovered unevenly. Genuinely enormous films like the Pathaan and Jawan vehicles for Shah Rukh Khan\'s comeback have demonstrated that there is still an appetite for big-screen Hindi spectacle.',
          'The most interesting question facing Bollywood today is whether it can navigate competition from Telugu, Tamil, and Malayalam cinema — all of which have expanded their share of the national box office at Hindi cinema\'s expense — while continuing to invest in the kind of filmmaking that has defined its most creatively vital periods.',
        ],
      },
    ],
    mustWatch: [
      { title: 'Sholay', year: 1975, language: 'Hindi', reason: 'The foundational masala film. India\'s most culturally embedded movie.' },
      { title: 'Dilwale Dulhania Le Jayenge', year: 1995, language: 'Hindi', reason: 'The film that ran in one cinema for 25 years. Essential 90s Bollywood.' },
      { title: 'Gangs of Wasseypur', year: 2012, language: 'Hindi', reason: 'Kashyap\'s five-hour crime epic. The peak of Hindi art cinema.' },
      { title: 'Dangal', year: 2016, language: 'Hindi', reason: 'The modern Bollywood sports drama at its finest.' },
      { title: '3 Idiots', year: 2009, language: 'Hindi', reason: 'Rajkumar Hirani\'s comedy-drama that defined a generation.' },
    ],
  },
];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
