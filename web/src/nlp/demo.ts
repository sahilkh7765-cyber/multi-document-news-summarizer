// NLP PROJECT - MULTI-DOCUMENT NEWS SUMMARIZATION WITH CROSS-SOURCE COVERAGE COMPARISON
// SAHIL JABIR KHAN 24AD1199
//
// Built-in demo corpus and reference summaries, copied verbatim from app.py (DEMO_CORPUS / DEMO_REFERENCES).
// Each sentence carries a fact id; a fact reported by only one source is ground-truth source-exclusive.

import type { Article } from './types';

export const DEMO_CORPUS: readonly Article[] = [
  {
    event: "E1",
    source: "Nagar Times",
    title: "",
    sents: [
      ["The Coastal Metro Line 4 extension was formally opened on Tuesday by the state transport minister.", "c1"],
      ["The new stretch adds 11.4 kilometres of track and nine additional stations to the network.", "c2"],
      ["It connects Sector 22 in the western suburbs directly to Harbour Junction.", "c3"],
      ["Officials placed the total project cost at 4,850 crore rupees.", "c4"],
      ["Daily ridership on the extended corridor is expected to reach 2.1 lakh passengers.", "c5"],
      ["The extension was completed roughly 14 months behind its original schedule.", "c6"],
      ["Fares on the new stretch have been frozen for the first three months of operation.", "e1a"],
    ],
  },
  {
    event: "E1",
    source: "Daily Chronicle",
    title: "",
    sents: [
      ["The state transport minister inaugurated the Coastal Metro Line 4 extension on Tuesday morning.", "c1"],
      ["Nine new stations and 11.4 kilometres of track have been added to the existing corridor.", "c2"],
      ["The line now runs from Sector 22 through to Harbour Junction without an interchange.", "c3"],
      ["The project carried a final cost of 4,850 crore rupees according to the transport department.", "c4"],
      ["Completion came 14 months later than the schedule announced at groundbreaking.", "c6"],
      ["Around 240 families were relocated from the alignment during construction of the corridor.", "e1b"],
    ],
  },
  {
    event: "E1",
    source: "Metro Mirror",
    title: "",
    sents: [
      ["Tuesday saw the opening of the Coastal Metro Line 4 extension by the transport minister.", "c1"],
      ["The extension brings nine stations and 11.4 kilometres of new track into service.", "c2"],
      ["Trains will now travel from Sector 22 to Harbour Junction on a single line.", "c3"],
      ["Ridership of about 2.1 lakh passengers a day is projected for the corridor.", "c5"],
      ["The corridor opened 14 months after the deadline set at the start of work.", "c6"],
      ["The leader of the opposition described the cost overrun on the project as unacceptable.", "e1c"],
    ],
  },
  {
    event: "E1",
    source: "Civic Herald",
    title: "",
    sents: [
      ["The transport minister opened the Coastal Metro Line 4 extension to the public on Tuesday.", "c1"],
      ["Passengers can now ride from Sector 22 to Harbour Junction without changing trains.", "c3"],
      ["The transport department put the cost of the work at 4,850 crore rupees.", "c4"],
      ["Projected daily ridership for the new section stands at 2.1 lakh passengers.", "c5"],
      ["Three of the nine new stations still have no working lift access for passengers.", "e1d"],
    ],
  },
  {
    event: "E2",
    source: "Nagar Times",
    title: "",
    sents: [
      ["State XI defeated Northern XI by six wickets in the final on Sunday evening.", "d1"],
      ["The side chased down a target of 214 runs inside 48 overs.", "d2"],
      ["Captain Rehan Sethi finished unbeaten on 96 to carry the innings.", "d3"],
      ["The win gives State XI their first title in twelve years.", "d4"],
      ["The final was played at Green Park Stadium in front of a full house.", "d5"],
      ["Northern XI seamer Aditya Rao claimed four wickets in a losing cause.", "d6"],
      ["A crowd of roughly 28,000 spectators attended the match.", "e2a"],
    ],
  },
  {
    event: "E2",
    source: "Daily Chronicle",
    title: "",
    sents: [
      ["A six wicket win over Northern XI on Sunday handed the trophy to State XI.", "d1"],
      ["The target of 214 was overhauled with two overs to spare in the 48th.", "d2"],
      ["An unbeaten 96 from captain Rehan Sethi anchored the successful chase.", "d3"],
      ["It is the first time in twelve years that State XI have won the competition.", "d4"],
      ["Aditya Rao took four wickets for Northern XI but could not stop the chase.", "d6"],
      ["Prize money for the competition was doubled by the board this season.", "e2b"],
    ],
  },
  {
    event: "E2",
    source: "Metro Mirror",
    title: "",
    sents: [
      ["State XI beat Northern XI by six wickets to lift the title on Sunday.", "d1"],
      ["Captain Rehan Sethi remained not out on 96 as the chase was completed.", "d3"],
      ["The victory ends a twelve year wait for silverware at the state association.", "d4"],
      ["Green Park Stadium hosted the final in front of a capacity crowd.", "d5"],
      ["Sethi indicated after the match that he is considering retirement from the format.", "e2c"],
    ],
  },
  {
    event: "E2",
    source: "Civic Herald",
    title: "",
    sents: [
      ["Northern XI were beaten by six wickets in Sunday's final at Green Park Stadium.", "d1"],
      ["State XI needed 214 to win and reached the total in 48 overs.", "d2"],
      ["The unbeaten innings of 96 by Rehan Sethi proved to be the difference.", "d3"],
      ["Green Park Stadium was the venue for the final on Sunday.", "d5"],
      ["Four wickets from Aditya Rao briefly gave Northern XI hope of defending the total.", "d6"],
      ["Rain delayed the start of play by forty minutes on the morning of the final.", "e2d"],
    ],
  },
  {
    event: "E3",
    source: "Nagar Times",
    title: "",
    sents: [
      ["The technology firm announced an investment of 3,200 crore rupees in a new data centre.", "f1"],
      ["The facility will come up near the Panvel industrial belt on the outskirts of the city.", "f2"],
      ["The company expects the project to create 1,400 direct jobs.", "f3"],
      ["The data centre is scheduled to be operational by 2028.", "f4"],
      ["A large share of the power for the site will be drawn from solar generation.", "f5"],
      ["A memorandum of understanding was signed with the state government this week.", "f6"],
      ["The land parcel acquired for the facility measures 62 acres.", "e3a"],
    ],
  },
  {
    event: "E3",
    source: "Daily Chronicle",
    title: "",
    sents: [
      ["An investment of 3,200 crore rupees in a data centre was announced by the technology firm.", "f1"],
      ["Panvel industrial belt has been selected as the location for the new facility.", "f2"],
      ["The project is expected to generate 1,400 direct jobs once complete.", "f3"],
      ["Operations at the data centre are targeted to begin in 2028.", "f4"],
      ["The state government and the company signed a memorandum of understanding this week.", "f6"],
      ["The local civic body has raised concerns about the water consumption of the facility.", "e3b"],
    ],
  },
  {
    event: "E3",
    source: "Metro Mirror",
    title: "",
    sents: [
      ["The technology company will put 3,200 crore rupees into a new data centre project.", "f1"],
      ["The site chosen is close to the Panvel industrial belt.", "f2"],
      ["Around 1,400 direct jobs are expected to follow from the investment.", "f3"],
      ["Solar generation will supply much of the electricity required by the site.", "f5"],
      ["A memorandum of understanding with the state was signed earlier in the week.", "f6"],
      ["A second phase of the project is planned and will depend on demand.", "e3c"],
    ],
  },
  {
    event: "E3",
    source: "Civic Herald",
    title: "",
    sents: [
      ["A data centre investment of 3,200 crore rupees was confirmed by the technology firm.", "f1"],
      ["The facility is planned near the Panvel industrial belt.", "f2"],
      ["The company has said 1,400 direct jobs will be created.", "f3"],
      ["The centre is expected to be running by 2028.", "f4"],
      ["Solar power will meet a large part of the energy demand at the site.", "f5"],
      ["The firm has been granted a five year exemption from state tax on the project.", "e3d"],
    ],
  },
];

export const DEMO_REFERENCES: Readonly<Record<string, string>> = {
  E1: "The state transport minister opened the Coastal Metro Line 4 extension on Tuesday. The stretch adds 11.4 kilometres of track and nine stations, linking Sector 22 with Harbour Junction. The transport department put the cost at 4,850 crore rupees. Daily ridership is projected at 2.1 lakh passengers. The corridor opened 14 months behind schedule.",
  E2: "State XI beat Northern XI by six wickets in Sunday's final at Green Park Stadium. The side chased 214 in 48 overs, with captain Rehan Sethi unbeaten on 96. Aditya Rao took four wickets for Northern XI. The result gives State XI their first title in twelve years.",
  E3: "A technology firm announced a 3,200 crore rupee data centre near the Panvel industrial belt. The project is expected to create 1,400 direct jobs and to be operational by 2028. Much of the power for the site will come from solar generation. A memorandum of understanding was signed with the state government.",
};
