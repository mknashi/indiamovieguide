import { useEffect, useState } from 'react';
import { RiArrowLeftLine, RiBookOpenLine } from 'react-icons/ri';
import { navigate } from '../router';
import { LANGUAGE_COLORS } from '../data/languageContent';

type ListEntry = {
  title: string;
  year: number;
  language: string;
  note: string;
};

type CuratedList = {
  id: string;
  title: string;
  tag: string;
  langKey: string; // matches LANGUAGE_COLORS key or 'All'
  intro: string;
  entries: ListEntry[];
};

const LISTS: CuratedList[] = [
  {
    id: 'bollywood-milestones',
    title: 'Bollywood Films That Shaped Indian Cinema',
    tag: 'Bollywood',
    langKey: 'Hindi',
    intro: "Over seventy years of Hindi cinema have produced a handful of films so influential that they permanently altered what Indian audiences expected from the movies — how stories were told, how songs were used, what emotions a film was allowed to explore. The list below is not a ranking of the 'best' Bollywood films by any single metric, but a selection of the most consequential ones: films that changed the industry, defined a decade, or introduced a new kind of filmmaking that everyone who followed had to reckon with.",
    entries: [
      { title: 'Sholay', year: 1975, language: 'Hindi', note: "The foundational Indian masala film. Two thieves are hired to capture a dacoit. Ramesh Sippy's direction, the dialogue by Salim-Javed, and the performances of Amitabh Bachchan, Dharmendra, and Amjad Khan created characters who entered the permanent vocabulary of Indian culture." },
      { title: 'Mughal-E-Azam', year: 1960, language: 'Hindi', note: "The most expensive Indian film of its era and still one of the most visually magnificent. The love story between Prince Salim and the court dancer Anarkali set the standard for epic historical romance." },
      { title: 'Dilwale Dulhania Le Jayenge', year: 1995, language: 'Hindi', note: "DDLJ ran continuously in Mumbai's Maratha Mandir cinema for over 25 years. It defined the template for the Bollywood diaspora romance and made Shah Rukh Khan and Kajol the defining couple of 1990s Hindi cinema." },
      { title: 'Lagaan', year: 2001, language: 'Hindi', note: "A cricket match against colonial-era British officers as a stand-in for national liberation. Aamir Khan's production earned an Academy Award nomination and introduced Indian cinema to a new international audience." },
      { title: '3 Idiots', year: 2009, language: 'Hindi', note: "The highest-grossing Indian film of its time at release. Rajkumar Hirani's comedy about engineering students challenging a rote-learning culture became a cultural touchstone for an entire generation of Indian youth." },
      { title: 'Dangal', year: 2016, language: 'Hindi', note: "A father trains his daughters to become world-class wrestlers. Aamir Khan's preparation and performance transformed the sports biopic in India, and the film went on to become the highest-grossing Indian film ever in China." },
      { title: 'Gangs of Wasseypur', year: 2012, language: 'Hindi', note: "Anurag Kashyap's five-hour crime epic follows a coal mafia dynasty across three generations. It proved that Hindi cinema could sustain the kind of sprawling, literary crime storytelling previously associated only with American prestige television." },
      { title: 'Deewar', year: 1975, language: 'Hindi', note: "The original Angry Young Man film. Amitabh Bachchan as a dock worker turned criminal whose path diverges from his police-officer brother. The Salim-Javed screenplay launched the template that Bollywood spent twenty years following." },
    ],
  },
  {
    id: 'bollywood-romance',
    title: 'Essential Bollywood Romances Across the Decades',
    tag: 'Bollywood',
    langKey: 'Hindi',
    intro: "Romance has always been at the heart of Hindi commercial cinema — from the tragic love stories of the 1950s and 60s through the diaspora romances of the 90s to the psychologically complex contemporary films that have reinvented the genre. These films are not just popular entertainments; they are records of how Indian society has thought about love, family, and desire across seven decades.",
    entries: [
      { title: 'Mughal-E-Azam', year: 1960, language: 'Hindi', note: "The definitive Indian period romance. Prince Salim and Anarkali's doomed love is staged with an operatic grandeur that no subsequent film has matched." },
      { title: 'Aradhana', year: 1969, language: 'Hindi', note: "Rajesh Khanna's star-making film and the template for the self-sacrificing romantic hero. The songs remain among the most beloved in Hindi film history." },
      { title: 'Dilwale Dulhania Le Jayenge', year: 1995, language: 'Hindi', note: "The NRI romance perfected. Shah Rukh Khan and Kajol's chemistry, the European locations, and the film's validation of tradition within a framework of modern love made it the defining Bollywood film of its era." },
      { title: 'Dil Chahta Hai', year: 2001, language: 'Hindi', note: "Farhan Akhtar's directorial debut reset the register for urban Hindi romance. Three friends, three very different love stories, and a film that felt genuinely contemporary for the first time in a generation." },
      { title: 'Jab We Met', year: 2007, language: 'Hindi', note: "Imtiaz Ali's screwball romantic drama with Kareena Kapoor in one of Bollywood's great comic performances. The film captures both the romance and the sadness of two people finding each other at the wrong time." },
      { title: 'Barfi!', year: 2012, language: 'Hindi', note: "Anurag Basu's charming, visually inventive film about a hearing-impaired man and two women who love him. Ranbir Kapoor's physical performance is the finest in recent Bollywood." },
      { title: 'Ae Dil Hai Mushkil', year: 2016, language: 'Hindi', note: "Karan Johar's meditation on unrequited love — a film about the kind of love that doesn't end in marriage, which is still relatively rare territory for mainstream Hindi cinema." },
    ],
  },
  {
    id: 'telugu-blockbusters',
    title: 'Top Telugu Blockbusters of the Pan-India Era',
    tag: 'Tollywood',
    langKey: 'Telugu',
    intro: "Telugu cinema entered a new era around 2015 when Baahubali proved that an Indian regional-language film could compete with Hollywood spectacles in scale, ambition, and global reach. The decade that followed produced a string of Telugu blockbusters that broke box office records, dominated national streaming charts, and drew international attention to Hyderabad's film industry. These are the films that define contemporary Tollywood — visually spectacular, emotionally direct, and made with craft that demands the biggest screen available.",
    entries: [
      { title: 'Baahubali: The Beginning', year: 2015, language: 'Telugu', note: "The film that changed what Indian cinema believed was possible. S.S. Rajamouli's fantasy epic introduced Mahishmati to the world and ended with one of the most-discussed cliffhangers in Indian film history." },
      { title: 'Baahubali 2: The Conclusion', year: 2017, language: 'Telugu', note: "Answered the question India had been asking for two years — and delivered one of the highest-grossing Indian films of all time. The battle sequences remain the benchmark for Indian epic cinema." },
      { title: 'RRR', year: 2022, language: 'Telugu', note: "Ram Charan and Jr. NTR play fictional versions of real freedom fighters in an alternate-history colonial epic. The Naatu Naatu sequence won the Academy Award for Best Original Song. A global phenomenon." },
      { title: 'Pushpa: The Rise', year: 2021, language: 'Telugu', note: "Allu Arjun as a red sandalwood smuggler who rises from the bottom of the criminal hierarchy. The film's swagger and its lead performance created a cultural phenomenon that extended far beyond Telugu audiences." },
      { title: 'Ala Vaikuntapuramulo', year: 2020, language: 'Telugu', note: "Trivikram Srinivas's writing and Allu Arjun's charisma combine in this family entertainer that broke Tamil Nadu box office records — an unusual achievement for a Telugu film and a sign of Tollywood's expanding reach." },
      { title: 'Magadheera', year: 2009, language: 'Telugu', note: "The film that first demonstrated Rajamouli's ability to blend fantasy, romance, and action spectacle at scale. Ram Charan's debut announced a new generation of Tollywood star — its visual effects still hold up." },
      { title: 'Jersey', year: 2019, language: 'Telugu', note: "A 36-year-old failed cricketer attempts a comeback to earn a national jersey for his son. Nani's most emotionally raw performance, and a film about failure that is more honest than most sports dramas allow themselves to be." },
      { title: 'Arjun Reddy', year: 2017, language: 'Telugu', note: "Vijay Deverakonda's career-defining performance as a brilliant but self-destructive surgeon. Sandeep Reddy Vanga's raw, uncompromising direction made it one of the most controversial and discussed Telugu films of recent years." },
    ],
  },
  {
    id: 'tamil-entry-points',
    title: 'Tamil Films for First-Time Viewers',
    tag: 'Kollywood',
    langKey: 'Tamil',
    intro: "Tamil cinema can feel daunting for newcomers — the industry produces hundreds of films a year across every conceivable genre, and its biggest stars have fandoms comparable to global pop icons. The list below is a curated entry point: films chosen because they are outstanding on their own terms and because they each represent a different facet of what Kollywood does best. Start here, and you will have a map for everything else the industry has to offer.",
    entries: [
      { title: 'Vikram', year: 2022, language: 'Tamil', note: "Kamal Haasan's long-awaited return to mass-action cinema is the best possible introduction to how Tamil films handle scale, ensemble storytelling, and the layered fan-service that rewards devotees without excluding newcomers." },
      { title: 'Kaithi', year: 2019, language: 'Tamil', note: "A father released after a decade in prison tries to reach his daughter before dawn while accidentally becoming the only person who can save a group of trapped police officers. Lokesh Kanagaraj directs a masterclass in sustained tension." },
      { title: 'Super Deluxe', year: 2019, language: 'Tamil', note: "Four apparently unrelated stories that converge in unexpected ways. Thiagarajan Kumararaja's film is wildly ambitious, funny, moving, and unlike anything else Tamil cinema has produced. Vijay Sethupathi gives one of the great performances of recent Indian cinema." },
      { title: 'Jai Bhim', year: 2021, language: 'Tamil', note: "Based on a true legal case from the 1990s involving police brutality against a tribal community. Suriya produced and starred in this devastating, important film that became one of Amazon Prime Video's most-watched Indian titles." },
      { title: 'Pariyerum Perumal', year: 2018, language: 'Tamil', note: "A law student from a lower-caste community navigates a college friendship shadowed by caste violence. Director Pa. Ranjith's most intimate film and one of the most honest portrayals of caste in Indian cinema." },
      { title: 'Ponniyin Selvan: Part 1', year: 2022, language: 'Tamil', note: "Mani Ratnam's adaptation of the beloved Tamil novel about the Chola empire. A gorgeous, sprawling period epic that demonstrates the full ambition of contemporary Kollywood on the largest possible canvas." },
      { title: 'Vada Chennai', year: 2018, language: 'Tamil', note: "The first part of Vetrimaaran's planned trilogy about the rise of organised crime in north Chennai. A political and personal epic with the density of a great novel — demanding but richly rewarding." },
      { title: 'Master', year: 2021, language: 'Tamil', note: "Vijay as a professor sent to a juvenile detention facility to face down a villain played by Vijay Sethupathi. A star-vehicle done with genuine craft, and one of the most purely enjoyable Tamil films of recent years." },
    ],
  },
  {
    id: 'malayalam-thrillers',
    title: 'Essential Malayalam Thrillers',
    tag: 'Mollywood',
    langKey: 'Malayalam',
    intro: "Malayalam cinema has produced some of the finest crime thrillers in Indian film history. What sets Mollywood thrillers apart is their commitment to tight plotting, psychological realism, and characters grounded in everyday Kerala life — no superhero detectives, no improbable escapes. The films below represent the best of this tradition: each one rewards patient viewers with carefully constructed mysteries and morally complex resolutions. If you are new to Malayalam cinema, this is one of the best entry points.",
    entries: [
      { title: 'Drishyam', year: 2013, language: 'Malayalam', note: "The gold standard of Indian thriller writing. A cable TV operator orchestrates a meticulously planned cover-up to protect his family. The film's final act is one of the most discussed twists in Indian cinema." },
      { title: 'Drishyam 2', year: 2021, language: 'Malayalam', note: "A rare sequel that surpasses the original. Six years on, the investigation is reopened. Mohanlal's performance is career-defining, and the screenplay is even more intricate than the first film." },
      { title: 'Joseph', year: 2018, language: 'Malayalam', note: "A retired police officer is pulled into a case connected to his own past. Joju George won the National Award for Best Actor for this performance — understated, haunted, and completely convincing." },
      { title: 'Forensic', year: 2020, language: 'Malayalam', note: "A procedural serial-killer thriller anchored in forensic science. Tovino Thomas plays a forensic expert whose investigation uncovers a killer hiding in plain sight. Tightly edited, efficiently paced." },
      { title: 'Joji', year: 2021, language: 'Malayalam', note: "A contemporary retelling of Macbeth set in a wealthy Kerala family. Fahadh Faasil's performance as the youngest son consumed by ambition is one of the most chilling in recent Indian cinema." },
      { title: 'Malik', year: 2021, language: 'Malayalam', note: "An epic crime thriller spanning decades, following the rise and fall of a community leader on a coastal island. Fahadh Faasil again, in a completely different register — commanding, political, tragic." },
      { title: 'Jallikattu', year: 2019, language: 'Malayalam', note: "More visceral than cerebral, but a masterclass in tension. A buffalo escapes a slaughterhouse and the entire village descends into primal chaos. Lijo Jose Pellissery's direction is unlike anything else in Indian cinema." },
      { title: 'Thondimuthalum Driksakshiyum', year: 2017, language: 'Malayalam', note: "A stolen chain, a bus journey, and two people whose stories become entangled with a policeman and his prisoner. Dileesh Pothan's film is a model of restrained, intelligent Malayalam realism." },
    ],
  },
  {
    id: 'kannada-global-rise',
    title: "Sandalwood's Breakthrough: Kannada Cinema Goes Global",
    tag: 'Sandalwood',
    langKey: 'Kannada',
    intro: "For most of its history, Kannada cinema was a respected regional industry known more for its literary films and social dramas than for commercial spectacle. That changed dramatically between 2018 and 2023 when a sequence of films — led by the KGF franchise and Kantara — turned Sandalwood into the most-discussed film industry in India. This list traces that story and adds context with the films that came before.",
    entries: [
      { title: 'KGF: Chapter 1', year: 2018, language: 'Kannada', note: "The film that announced Yash as a pan-India star and Prashanth Neel as a director with blockbuster instincts. Set in the gold mining fields of Kolar, it built a mythology that millions of viewers immediately wanted more of." },
      { title: 'KGF: Chapter 2', year: 2022, language: 'Kannada', note: "One of the highest-grossing Indian films ever made. The sequel expanded the mythology, the scale, and the fan base in every direction simultaneously. Its opening weekend box office broke records held by Bollywood giants." },
      { title: 'Kantara', year: 2022, language: 'Kannada', note: "Rishab Shetty's mythological thriller about land rights, forest spirits, and the collision of modern and traditional power. The climax became one of the most-discussed scenes in recent Indian cinema. A Netflix hit worldwide." },
      { title: 'Ulidavaru Kandanthe', year: 2014, language: 'Kannada', note: "Rakshit Shetty's neo-noir crime thriller told from five different perspectives. Made years before the KGF era, it signalled that a new generation of Kannada filmmakers had the ambition to push the industry's boundaries." },
      { title: 'Lucia', year: 2013, language: 'Kannada', note: "A crowd-funded art-house film about a man whose dreams and waking life begin to blur. Pawan Kumar's debut film won national attention and started a conversation about the artistic potential of Kannada independent cinema." },
      { title: 'Vikrant Rona', year: 2022, language: 'Kannada', note: "Kichcha Sudeep's ambitious supernatural action film, released in 3D across multiple languages. A sign of the ambition that post-KGF Sandalwood now takes for granted." },
    ],
  },
  {
    id: 'marathi-essentials',
    title: 'Essential Marathi Films: A New Wave of Realism',
    tag: 'Marathi',
    langKey: 'Marathi',
    intro: "Marathi cinema has experienced a remarkable renaissance since the late 2000s — driven by state government support, a generation of socially committed directors, and an audience that has come to expect films grounded in the specific landscapes and lives of Maharashtra. Where commercial Marathi cinema once mimicked Bollywood on smaller budgets, the new wave produces films with their own distinct visual style, thematic preoccupations, and moral urgency. These are the films that define this new tradition.",
    entries: [
      { title: 'Sairat', year: 2016, language: 'Marathi', note: "Nagraj Manjule's story of a cross-caste romance in rural Maharashtra is one of the most powerful films about caste violence in Indian cinema. The ending is devastating and unforgettable. It became the highest-grossing Marathi film ever at that time." },
      { title: 'Fandry', year: 2013, language: 'Marathi', note: "Manjule's debut feature: a young boy from the lowest caste falls for a girl from a higher community. Shot with documentary naturalism and performed with extraordinary conviction by non-professional actors." },
      { title: 'Court', year: 2014, language: 'Marathi', note: "Chaitanya Tamhane's debut is a masterwork of procedural observation — a folksinger is arrested on charges of incitement to suicide, and the trial becomes a study of how the legal system processes human beings. National Award winner." },
      { title: 'Kaala', year: 2018, language: 'Tamil/Marathi', note: "Pa. Ranjith's film set in Dharavi, Mumbai, features Rajinikanth as a community leader of Marathi migrants resisting displacement. A rare Bollywood-adjacent film that centres Marathi working-class identity with political honesty." },
      { title: 'Natsamrat', year: 2016, language: 'Marathi', note: "Nana Patekar's tour-de-force performance as an ageing actor abandoned by his family. Based on a celebrated Marathi stage play, it is the definitive text of the contemporary Marathi theatre-cinema relationship." },
      { title: 'Ventilator', year: 2016, language: 'Marathi', note: "Rajkumari Hirani-produced ensemble comedy-drama about a large family gathering when a patriarch falls into a coma. Won three National Awards including Best Director for Rajesh Mapuskar." },
    ],
  },
  {
    id: 'bengali-classics-and-new-wave',
    title: 'Bengali Cinema: From Satyajit Ray to the Streaming Era',
    tag: 'Bengali',
    langKey: 'Bengali',
    intro: "Bengali cinema carries one of the richest artistic traditions in Indian film — anchored by the international stature of Satyajit Ray and the parallel achievements of Ritwik Ghatak and Mrinal Sen, and continuing through a new generation of directors who have found both domestic and streaming audiences. Bengali film is often more literary and less commercially driven than other Indian industries, which gives it a distinctive character: quieter, more interior, more interested in character than event. This list spans the tradition.",
    entries: [
      { title: 'Pather Panchali', year: 1955, language: 'Bengali', note: "Satyajit Ray's debut and the first film of the Apu Trilogy. A landmark of world cinema — the story of a poor rural family in Bengal told with a simplicity and emotional truth that remains overwhelming. Essential viewing for any serious filmgoer." },
      { title: 'Charulata', year: 1964, language: 'Bengali', note: "Ray's most formally perfect film: a study of a 19th-century educated Bengali woman whose intellectual and emotional life is stifled by her marriage and awakened by her brother-in-law. The camera movements are extraordinary." },
      { title: 'Meghe Dhaka Tara', year: 1960, language: 'Bengali', note: "Ritwik Ghatak's masterpiece: a displaced family in Calcutta, held together by a daughter whose sacrifice destroys her. A film about partition, about women's labour, and about the weight of love without recognition." },
      { title: 'Kaahon', year: 2016, language: 'Bengali', note: "A taut contemporary thriller in which a playwright becomes entangled in a murder investigation. One of the best examples of Bengali genre cinema finding commercial traction without sacrificing craft." },
      { title: 'Byomkesh Bakshi', year: 2015, language: 'Bengali', note: "Dibakar Banerjee's stylish, period-set crime film introducing Bengali literature's most beloved detective. A love letter to 1940s Calcutta and a smart reframing of the classic detective story for a contemporary audience." },
      { title: 'Praktan', year: 2016, language: 'Bengali', note: "A divorced couple encounters each other on a train journey. Shiboprosad Mukherjee and Nandita Roy's film is a master class in adult romantic drama — restrained, honest, and deeply moving about the aftermath of a marriage." },
    ],
  },
  {
    id: 'indian-crime-cross-language',
    title: 'The Best of Indian Crime Cinema — Across All Languages',
    tag: 'All Languages',
    langKey: 'All',
    intro: "Indian crime cinema is not a single tradition — it is eight distinct traditions running in parallel, each shaped by the landscape, history, and storytelling conventions of its industry. Bollywood's crime films often draw on the underworld mythology of Mumbai; Tamil crime thrillers are rooted in the political geography of Chennai; Malayalam crime films are intimate procedurals; Telugu crime dramas explore dynastic feuds and political corruption. The films below represent the best of these traditions in conversation with each other.",
    entries: [
      { title: 'Gangs of Wasseypur', year: 2012, language: 'Hindi', note: "The most ambitious Indian crime film ever made. Anurag Kashyap's five-hour saga traces a coal-country blood feud across three generations with the density and moral complexity of the great American crime novels." },
      { title: 'Drishyam', year: 2013, language: 'Malayalam', note: "The perfect domestic thriller. A cable TV operator's carefully planned cover-up — built from absolute ordinariness — is the template that dozens of subsequent Indian thrillers have tried and failed to replicate." },
      { title: 'Vikram Vedha', year: 2017, language: 'Tamil', note: "A police officer hunting a gangster discovers that the story of good and evil is more complicated than he assumed. Vijay Sethupathi's gangster is one of the great creations of recent Tamil cinema." },
      { title: 'Kaithi', year: 2019, language: 'Tamil', note: "A lean, relentless crime-action film with no romantic subplot and no songs — just a brilliantly sustained night-long chase structure. Lokesh Kanagaraj's direction is impeccable." },
      { title: 'Satya', year: 1998, language: 'Hindi', note: "Ram Gopal Varma's foundational Mumbai underworld film. A stranger arrives in the city and is absorbed into the criminal ecosystem. The film that created the template for an entire generation of Hindi crime cinema." },
      { title: 'Joji', year: 2021, language: 'Malayalam', note: "The domestic crime film as Shakespearean tragedy. Fahadh Faasil is exceptional as a youngest son driven to murder by frustrated ambition. The film's restraint makes its violence more horrifying than any action sequence." },
      { title: 'Arjun Reddy', year: 2017, language: 'Telugu', note: "Sandeep Reddy Vanga's raw, uncomfortable portrait of a self-destructive surgeon. A film that polarised audiences and critics but proved Telugu cinema could sustain genuinely uncomfortable moral complexity." },
      { title: 'Kaala', year: 2018, language: 'Tamil', note: "Pa. Ranjith's political crime film with Rajinikanth as a Dharavi community leader. Crime as resistance; the gangster as a figure of subaltern justice." },
    ],
  },
  {
    id: 'indian-sports-films',
    title: "India's Greatest Sports Films",
    tag: 'All Languages',
    langKey: 'All',
    intro: "Indian sports cinema has become one of the most creatively and commercially vital genres in the country over the past two decades. What makes the best Indian sports films special is that the sport is almost always a vehicle for something larger — gender rights, caste, national identity, class — so that the climactic match or race carries emotional weight far beyond the scoreline. The films below represent the peak of this genre, drawn from across India's film industries.",
    entries: [
      { title: 'Lagaan', year: 2001, language: 'Hindi', note: "A colonial-era village bets its tax exemption on a cricket match against the British garrison. Ashutosh Gowariker's three-hour epic is the film that established the grammar of the Indian sports drama." },
      { title: 'Dangal', year: 2016, language: 'Hindi', note: "A father in Haryana trains his daughters to become Commonwealth Games wrestling champions against every social obstacle imaginable. Aamir Khan's most commercially successful film and one of his most emotionally effective." },
      { title: 'Chak De! India', year: 2007, language: 'Hindi', note: "A disgraced former hockey player coaches the Indian women's national team. Shah Rukh Khan strips away his usual romantic-hero persona to deliver a committed, quiet performance. The final match is still electrifying." },
      { title: 'Sarpatta Parambarai', year: 2021, language: 'Tamil', note: "Pa. Ranjith's boxing film set in 1970s Chennai clan rivalries is as much a film about caste, identity, and political power as it is about sport. The boxing sequences are the most physically convincing in recent Indian cinema." },
      { title: 'Irudhi Suttru', year: 2016, language: 'Tamil', note: "A difficult, disgraced boxing coach discovers a natural talent among a fishing community girl. R. Madhavan and Ritika Singh form one of Tamil cinema's great mentor-student pairings." },
      { title: 'Jersey', year: 2019, language: 'Telugu', note: "A 36-year-old failed cricketer attempts a comeback to earn a national jersey for his son. Nani's performance is the most emotionally raw in Telugu sports cinema, and the climax is genuinely devastating." },
      { title: '83', year: 2021, language: 'Hindi', note: "The story of India's improbable 1983 Cricket World Cup victory, told with genuine emotional intelligence. Ranveer Singh as Kapil Dev is revelatory." },
    ],
  },
  {
    id: 'indian-films-globally-significant',
    title: 'Indian Films That Found a Global Audience',
    tag: 'All Languages',
    langKey: 'All',
    intro: "For most of the twentieth century, Indian cinema's international reach was limited to diaspora communities and a handful of art-house films that found European festival audiences. That changed dramatically in the streaming era — especially between 2017 and 2023, when a series of Telugu, Kannada, and Malayalam films broke through to mainstream international viewership on Netflix, Amazon Prime, and in theatrical markets where Indian films had rarely appeared. These are the films that crossed over.",
    entries: [
      { title: 'RRR', year: 2022, language: 'Telugu', note: "The film that introduced the world to the phrase 'mass masala' and gave S.S. Rajamouli a global auteur reputation. Naatu Naatu's Oscar win was the most visible moment yet in Indian cinema's international mainstream breakthrough." },
      { title: 'Baahubali 2: The Conclusion', year: 2017, language: 'Telugu', note: "The film that proved Indian visual effects and production design could compete internationally. Its US box office opening broke records for Indian films and demonstrated a genuine Western appetite for Indian epic cinema." },
      { title: 'Kantara', year: 2022, language: 'Kannada', note: "Netflix's decision to platform Kantara globally turned a local folk-mythology thriller into an international conversation. The film trended globally and introduced millions of viewers to Karnataka's tribal traditions." },
      { title: 'Joji', year: 2021, language: 'Malayalam', note: "Fahadh Faasil's performance in this dark domestic drama earned him international critical recognition and helped establish Malayalam cinema's reputation on Netflix as a home for uncommonly intelligent, actor-driven films." },
      { title: 'Lagaan', year: 2001, language: 'Hindi', note: "The original Indian crossover. Ashutosh Gowariker's film earned an Academy Award nomination for Best Foreign Language Film and opened genuine Western press coverage of Indian cinema." },
      { title: 'Pather Panchali', year: 1955, language: 'Bengali', note: "Satyajit Ray's debut has been in continuous global circulation for seventy years — the only Indian film that is genuinely part of the international art cinema canon." },
      { title: 'The Lunchbox', year: 2013, language: 'Hindi', note: "Ritesh Batra's quiet love story about a misdelivered lunch found art-house audiences worldwide and earned a standing ovation at Cannes. An outlier in Bollywood's commercial landscape that demonstrated the global appetite for Indian intimate drama." },
      { title: 'Kumbalangi Nights', year: 2019, language: 'Malayalam', note: "A film about four dysfunctional brothers in a Kerala backwater village. Its gentle observational comedy and emotional honesty earned international festival recognition and positioned Fahadh Faasil as a global art-house star." },
    ],
  },
];

const FILTER_OPTIONS = [
  { label: 'All', key: 'All' },
  { label: 'Hindi', key: 'Hindi' },
  { label: 'Telugu', key: 'Telugu' },
  { label: 'Tamil', key: 'Tamil' },
  { label: 'Malayalam', key: 'Malayalam' },
  { label: 'Kannada', key: 'Kannada' },
  { label: 'Marathi', key: 'Marathi' },
  { label: 'Bengali', key: 'Bengali' },
];

export function ListsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('lang') || 'All';
    }
    return 'All';
  });

  useEffect(() => {
    // Sync filter if URL changes (e.g. back/forward navigation)
    const params = new URLSearchParams(window.location.search);
    const lang = params.get('lang') || 'All';
    setActiveFilter(lang);
    setExpanded(null);
  }, []);

  const filtered = activeFilter === 'All'
    ? LISTS
    : LISTS.filter((l) => l.langKey === activeFilter || l.langKey === 'All');

  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <button className="ghost-button" type="button" onClick={() => navigate('/')}>
          <span style={{ marginRight: 6, display: 'inline-flex', alignItems: 'center' }}><RiArrowLeftLine /></span>
          Back
        </button>
        <span className="inline-pill">Film Guides</span>
      </div>

      <div className="detail" style={{ marginTop: 14, padding: '22px 24px' }}>
        <h4 style={{ marginTop: 0, marginBottom: 8 }}>
          <span style={{ marginRight: 8, display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}>
            <RiBookOpenLine size={20} />
          </span>
          Editorial Film Guides
        </h4>
        <div className="tagline" style={{ lineHeight: 1.8 }}>
          Hand-curated guides to essential, landmark, and unmissable films from across India's eight
          major film industries. Each guide is an entry point — a way into a genre, an industry, or
          a moment in Indian cinema's history. Filter by industry to find guides specific to your
          favourite language cinema.
        </div>
        <div className="tagline" style={{ lineHeight: 1.8, marginTop: 8 }}>
          For deeper reading, visit our{' '}
          <a
            href="/articles"
            style={{ textDecoration: 'underline' }}
            onClick={(e) => { e.preventDefault(); navigate('/articles'); }}
          >
            Articles
          </a>{' '}
          section for long-form pieces on individual industries and their defining films.
        </div>
      </div>

      {/* Industry filter */}
      <div className="detail" style={{ marginTop: 12 }}>
        <div className="meta" style={{ flexWrap: 'wrap' }}>
          {FILTER_OPTIONS.map((opt) => {
            const colors = opt.key !== 'All' ? LANGUAGE_COLORS[opt.key] : null;
            const isActive = activeFilter === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                className={`filter ${isActive ? 'active' : ''}`}
                style={isActive && colors ? { background: colors.accent + '22', borderColor: colors.accent + '66', color: colors.accent } : {}}
                onClick={() => {
                  setActiveFilter(opt.key);
                  setExpanded(null);
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="section-header" style={{ marginTop: 20 }}>
        <h3>
          {activeFilter === 'All' ? 'All Guides' : `${activeFilter} Cinema`}
        </h3>
        <span className="inline-pill">{filtered.length} guides</span>
      </div>

      {filtered.map((list) => {
        const isOpen = expanded === list.id;
        const colors = list.langKey !== 'All' ? LANGUAGE_COLORS[list.langKey] : null;

        return (
          <div
            key={list.id}
            className="detail"
            style={{
              marginTop: 12,
              transition: 'background 0.2s',
              ...(isOpen && colors ? { background: colors.bg, borderColor: colors.border } : {}),
            }}
          >
            <div
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}
              onClick={() => setExpanded(isOpen ? null : list.id)}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    className="inline-pill"
                    style={colors ? { background: colors.accent, color: '#fff', border: 'none' } : {}}
                  >
                    {list.tag}
                  </span>
                  <span className="tagline">{list.entries.length} films</span>
                </div>
                <h4 style={{ margin: '8px 0 0' }}>{list.title}</h4>
              </div>
              <span className="tagline" style={{ fontSize: 20, lineHeight: 1, paddingTop: 4, flexShrink: 0 }}>
                {isOpen ? '−' : '+'}
              </span>
            </div>

            {isOpen && (
              <>
                <div className="tagline" style={{ lineHeight: 1.8, marginTop: 12 }}>
                  {list.intro}
                </div>

                <div style={{ marginTop: 16 }}>
                  {list.entries.map((entry, i) => (
                    <div
                      key={`${entry.title}-${entry.year}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '28px 1fr',
                        gap: '0 12px',
                        paddingTop: i === 0 ? 0 : 14,
                        marginTop: i === 0 ? 0 : 14,
                        borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.07)',
                        alignItems: 'start',
                      }}
                    >
                      <div
                        className="tagline"
                        style={{
                          fontWeight: 700,
                          fontSize: 13,
                          color: colors?.accent || 'var(--accent)',
                          paddingTop: 2,
                          textAlign: 'right',
                        }}
                      >
                        {i + 1}.
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                          <a
                            href={`/search?q=${encodeURIComponent(entry.title)}`}
                            style={{ fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}
                            onClick={(e) => {
                              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                              e.preventDefault();
                              navigate(`/search?q=${encodeURIComponent(entry.title)}`);
                            }}
                          >
                            {entry.title}
                          </a>
                          <span className="tagline" style={{ fontSize: 13 }}>
                            {entry.year} · {entry.language}
                          </span>
                        </div>
                        <div className="tagline" style={{ lineHeight: 1.7, marginTop: 4 }}>
                          {entry.note}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
