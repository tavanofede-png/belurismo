// Hotels as published on travel.belo.app, read from its search pages in a browser.
// belo exposes no API for Travel inventory, so this is a dated snapshot: prices are
// the ones shown on checkedAt for checkedDates, never a live quote.
// ponytail: hand-kept catalog; replace with a real Travel API the day belo publishes one.

export type BeloTravelHotel = {
  id: string;
  name: string;
  address: string;
  stars: number | null;
  ratingLabel: string;
  rating: number;
  listPrice: number;
  price: number;
  discount: number;
  image: string | null;
};
type Destination = {
  name: string;
  match: RegExp;
  q: string;
  placeId: string | null;
  sorting: string;
  checkedAt: string;
  checkedDates: [string, string];
  hotels: BeloTravelHotel[];
};

const cdn = (id: string, file: string) => `https://cdn.entravel.com/images/properties/${id}/${file}`;

export const beloTravelCatalog: Destination[] = [
  {
    name: "San Miguel de Tucumán, Argentina",
    match: /tucum[aá]n/i,
    q: "San Miguel de Tucumán, Tucumán Province, Argentina",
    placeId: "ChIJA2nF1pI3IpQRJ2XFtZJbjfg",
    sorting: "Discount-desc",
    checkedAt: "2026-10-28",
    checkedDates: ["2026-10-28", "2026-10-29"],
    hotels: [
      { id: "5952347", name: "Sheraton Tucuman Hotel", address: "Av. Soldati y Calle Haití, San Miguel de Tucumán", stars: 4, ratingLabel: "Excelente", rating: 4.5, listPrice: 283246, price: 181277, discount: 36, image: cdn("5952347", "89cdfa9449f2bb8e658ef37456ee40308b2241bc.jpg") },
      { id: "15361755", name: "Ramada Plaza by Wyndham Tucuman", address: "Laprida 35, San Miguel de Tucumán", stars: 4, ratingLabel: "Bueno", rating: 3.3, listPrice: 252442, price: 191856, discount: 24, image: cdn("15361755", "8385deb078ea3b2685271559202f6249a7f3c68b.jpg") },
      { id: "111276535", name: "Hotel del Jardín", address: "Laprida, San Miguel de Tucumán", stars: 4, ratingLabel: "Bueno", rating: 3.4, listPrice: 62323, price: 49859, discount: 20, image: cdn("111276535", "da35126fb903f0978f9ce4c39ce6bf57edee1859.jpg") },
    ],
  },
  {
    name: "Florianópolis, Brasil",
    match: /florian[oó]polis|floripa/i,
    q: "Florianópolis, Santa Catarina, Brazil",
    placeId: "ChIJ1zLGsk45J5URRscEagtVvIE",
    sorting: "Discount-desc",
    checkedAt: "2026-10-28",
    checkedDates: ["2026-10-28", "2026-10-29"],
    hotels: [
      { id: "2308904", name: "Hotel Jurerê Beach Village - OFICIAL", address: "Al. Cesar Nascimento, 648, Florianópolis", stars: 4, ratingLabel: "Muy bueno", rating: 4.3, listPrice: 317765, price: 127106, discount: 60, image: cdn("2308904", "43610018f926bd9c5c374fdc0b84785ea46a7896.jpg") },
      { id: "4006095", name: "IL Campanario Villaggio Resort - OFICIAL", address: "Avenida Dos Buzios 1760, Florianópolis", stars: 4, ratingLabel: "Muy bueno", rating: 4.3, listPrice: 340581, price: 136233, discount: 60, image: cdn("4006095", "f69d5fcc28aeca141131d0d65335975b08a5d10c.jpg") },
      { id: "1807576", name: "Majestic Palace Hotel", address: "Av. Rubens De Arruda Ramos, 2746, Florianópolis", stars: 4, ratingLabel: "Muy bueno", rating: 4.3, listPrice: 305905, price: 201897, discount: 34, image: cdn("1807576", "d2417373e900d37c74c6effe0d832861fc909a5b.jpg") },
      { id: "82829", name: "Intercity Florianópolis", address: "Avenida Paulo Fontes, 1210, Florianópolis", stars: 4, ratingLabel: "Muy bueno", rating: 4.3, listPrice: 246019, price: 162373, discount: 34, image: cdn("82829", "8a46312f4d8b0c75bb419367e73ce78ccbdd57d2.jpg") },
      { id: "60339586", name: "LK Design Hotel", address: "R. Bocaiúva 1755, Florianópolis", stars: 4, ratingLabel: "Excelente", rating: 4.9, listPrice: 445623, price: 325305, discount: 27, image: cdn("60339586", "0a9373bfc0d32eafdd55e664d550c7717a533611.jpg") },
      { id: "2173596", name: "Oceania Park Hotel Spa & Convention Center by RB Hotelaria", address: "Rua dos Mariscos, 550, Florianópolis", stars: 4, ratingLabel: "Muy bueno", rating: 4.1, listPrice: 164916, price: 120389, discount: 27, image: cdn("2173596", "7825b1b5391f814184768dc5349cc874d6bc957c.jpg") },
      { id: "2851050", name: "Hotel Boutique Quinta das Videiras", address: "Rua Afonso Luis Borba, 113, Florianópolis", stars: 5, ratingLabel: "Excelente", rating: 4.8, listPrice: 472495, price: 359096, discount: 24, image: cdn("2851050", "e8ca1bf0e65afe4572951ea63d9a4410e6b593d1.jpg") },
      { id: "37800578", name: "Intercity Portofino Florianópolis", address: "Rodovia José Carlos Daux, 3270, Florianópolis", stars: 4, ratingLabel: "Excelente", rating: 4.6, listPrice: 214090, price: 164850, discount: 23, image: cdn("37800578", "ce4530e69952d2cb7c0476bdec37acd45a66229a.jpg") },
      { id: "43953", name: "Slaviero Baía Norte Florianópolis", address: "Avenida Beira Mar Norte, 220, Florianópolis", stars: 4, ratingLabel: "Muy bueno", rating: 4.1, listPrice: 170851, price: 133264, discount: 22, image: cdn("43953", "3213c6d207bb9147e4144e1ad9f17acab5a1e812.jpg") },
      { id: "1582024", name: "Novotel Florianópolis", address: "Av. Rubens Arruda Ramos, 2034, Florianópolis", stars: 4, ratingLabel: "Excelente", rating: 4.6, listPrice: 289402, price: 234416, discount: 19, image: cdn("1582024", "a1c8bebf3b114fbfe96914021452998febce081b.jpg") },
    ],
  },
  {
    name: "São Paulo, Brasil",
    match: /s[aã]o paulo|sampa/i,
    q: "São Paulo, Brazil",
    placeId: "ChIJ0WGkg4FEzpQRrlsz_whLqZs",
    sorting: "Discount-desc",
    checkedAt: "2026-10-28",
    checkedDates: ["2026-10-28", "2026-10-29"],
    hotels: [
      { id: "26731848", name: "JW Marriott Hotel Sao Paulo", address: "Av Nacoes Unidas 14 401, São Paulo", stars: 5, ratingLabel: "Excelente", rating: 4.8, listPrice: 1496415, price: 598566, discount: 60, image: cdn("26731848", "b806f2279ccc9b11db7c4101d1f988a08a463dd9.jpg") },
      { id: "1048190", name: "Hotel Nacional Inn Jaraguá São Paulo", address: "R Martins Fontes 71 Centro, São Paulo", stars: 4, ratingLabel: "Muy bueno", rating: 4.4, listPrice: 647064, price: 258826, discount: 60, image: cdn("1048190", "3030fb2f44a037256f80ab49c552e3d930463db3.jpg") },
      { id: "198375", name: "InterContinental São Paulo by IHG", address: "Alameda Santos 1123, São Paulo", stars: 5, ratingLabel: "Excelente", rating: 4.5, listPrice: 1100184, price: 484081, discount: 56, image: cdn("198375", "eb185284f8c359d0a0ea81f6675fd3dc2657ca96.jpg") },
      { id: "903717", name: "Pullman São Paulo Guarulhos Airport", address: "Rodovia Hélio Smidt s/n, Sector 1, Guarulhos", stars: 4, ratingLabel: "Excelente", rating: 4.7, listPrice: 773417, price: 363506, discount: 53, image: cdn("903717", "a95f9afe80a7408a640255aa94467411ce6f055f.jpg") },
      { id: "792346", name: "INNSiDE by Meliá São Paulo Higienópolis", address: "Rua Maranhao 371, São Paulo", stars: 4, ratingLabel: "Muy bueno", rating: 4.3, listPrice: 767649, price: 429884, discount: 44, image: cdn("792346", "77da485ab31cb036d4d338bdf9956fc89d524328.jpg") },
      { id: "15902804", name: "Palacio Tangara, Oetker Hotels", address: "Rua Deputado Laercio Corte 1501, São Paulo", stars: 5, ratingLabel: "Excelente", rating: 4.8, listPrice: 1918695, price: 1093657, discount: 43, image: cdn("15902804", "50bc7bb4c62ba83d6d345a03c42fff1f0866776e.jpg") },
      { id: "1062869", name: "Melia Paulista", address: "Av Paulista, 2181, São Paulo", stars: 5, ratingLabel: "Excelente", rating: 4.5, listPrice: 701375, price: 420825, discount: 40, image: cdn("1062869", "f95b80f40e4c7bd5e82dc9d5662423dfae4127ed.jpg") },
      { id: "433447", name: "Radisson Hotel Paulista Sao Paulo", address: "Alameda Santos, 85, São Paulo", stars: 4, ratingLabel: "Muy bueno", rating: 4.4, listPrice: 741069, price: 444642, discount: 40, image: cdn("433447", "bb7ee8d6c351381761fd7d14559bb5ff270d22c7.jpg") },
      { id: "25141", name: "Sao Paulo Airport Marriott Hotel", address: "Av Ministro Evandro Lins e Silva 10/100, Guarulhos", stars: 4, ratingLabel: "Excelente", rating: 4.6, listPrice: 584306, price: 373956, discount: 36, image: cdn("25141", "05851cd0fa88af15cfd1c7284ebd3e4245145f37.jpg") },
      { id: "572214", name: "Quality Suites Alphaville", address: "Alameda Mamore 333, Barueri", stars: 4, ratingLabel: "Bueno", rating: 3.9, listPrice: 286206, price: 194620, discount: 32, image: cdn("572214", "72a1616a88bf7017b513be14fded4e38872ef4d2.jpg") },
    ],
  },
  {
    name: "Río de Janeiro, Brasil",
    match: /\br[ií]o de janeiro\b|\br[ií]o\b(?! grande| negro| cuarto| gallegos)|\bcarioca/i,
    q: "Rio de Janeiro, Brazil",
    placeId: "ChIJW6AIkVXemwARTtIvZ2xC3FA",
    sorting: "Discount-desc",
    checkedAt: "2026-10-28",
    checkedDates: ["2026-10-28", "2026-10-29"],
    hotels: [
      { id: "10581", name: "Sheraton Grand Rio Hotel & Resort", address: "Avenida Niemeyer 121, Leblon, Río de Janeiro", stars: 5, ratingLabel: "Excelente", rating: 4.5, listPrice: 1078912, price: 517878, discount: 52, image: cdn("10581", "d705a8e3e35efee6f9cb2a39b3e8de4c25d7a85f.jpg") },
      { id: "15491185", name: "Ritz Copacabana Hotel", address: "Rua Xavier da Silveira 13, Copacabana, Río de Janeiro", stars: 4, ratingLabel: "Muy bueno", rating: 4.4, listPrice: 516212, price: 252944, discount: 51, image: cdn("15491185", "4f8871c77c5c90eeb70fdc5229c5471bc529eb7b.jpg") },
      { id: "13455131", name: "Radisson Barra Rio De Janeiro", address: "Av. Evandro Lins e Silva 600, Barra da Tijuca, Río de Janeiro", stars: 5, ratingLabel: "Muy bueno", rating: 4.4, listPrice: 417328, price: 208664, discount: 50, image: cdn("13455131", "5f7fd19ca1ae3a9d4951adab9ebeef649a8caaa1.jpg") },
      { id: "14441", name: "PortoBay Rio de Janeiro", address: "Avenida Atlântica 1500, Copacabana, Río de Janeiro", stars: 4, ratingLabel: "Excelente", rating: 4.6, listPrice: 540047, price: 280825, discount: 48, image: cdn("14441", "23e781a68f5b09bc99b4d4c377aa978955c9589f.jpg") },
      { id: "42275495", name: "Hotel Nacional Rio de Janeiro OFICIAL", address: "Av. Niemeyer 769, São Conrado, Río de Janeiro", stars: 5, ratingLabel: "Excelente", rating: 4.5, listPrice: 479694, price: 263832, discount: 45, image: cdn("42275495", "afbc2d762cb40e16ea0d4c2ad9ceba90a3b79a43.jpg") },
      { id: "1327062", name: "Royal Rio Palace Hotel", address: "Rua Duvivier 82, Copacabana, Río de Janeiro", stars: 4, ratingLabel: "Muy bueno", rating: 4.1, listPrice: 238136, price: 130975, discount: 45, image: cdn("1327062", "d0e9004ae80d44624c2693fafe9d983207adc8bd.jpg") },
      { id: "526870", name: "Américas Benidorm Hotel", address: "Rua Barata Ribeiro 547, Copacabana, Río de Janeiro", stars: 4, ratingLabel: "Muy bueno", rating: 4.3, listPrice: 255175, price: 148002, discount: 42, image: cdn("526870", "2ed4755c5c76dcad85036561e4802098a694b999.jpg") },
      { id: "542137", name: "Hotel Arpoador", address: "Rua Francisco Otaviano 177, Arpoador, Río de Janeiro", stars: 4, ratingLabel: "Muy bueno", rating: 4.4, listPrice: 1250770, price: 762970, discount: 39, image: cdn("542137", "12151a1aaf5fc1bf15e40589f4bb145111c4e594.jpg") },
      { id: "889673", name: "Orla Copacabana Hotel", address: "Avenida Atlântica 4122, Copacabana, Río de Janeiro", stars: 4, ratingLabel: "Excelente", rating: 4.6, listPrice: 319803, price: 195080, discount: 39, image: cdn("889673", "62ab1afdd6e1f5286af5cf794a24020558316e93.jpg") },
      { id: "1363050", name: "Windsor Barra Hotel", address: "Avenida Lúcio Costa 2630, Barra da Tijuca, Río de Janeiro", stars: 5, ratingLabel: "Excelente", rating: 4.6, listPrice: 359915, price: 223147, discount: 38, image: cdn("1363050", "89a520897276bbc709b4a47e7efedfceccfe3871.jpg") },
    ],
  },
  {
    name: "Santiago de Chile, Chile",
    // Plain "Santiago" means Chile here, never Santiago del Estero or de Compostela.
    match: /\bsantiago\b(?!\s+del?\s+(?:estero|compostela))/i,
    q: "Santiago de Chile, Chile",
    placeId: "ChIJL68lBEHFYpYRMQkPQDzVdYQ",
    sorting: "Discount-desc",
    checkedAt: "2026-10-28",
    checkedDates: ["2026-10-28", "2026-10-29"],
    hotels: [
      { id: "21429425", name: "Hotel Las Majadas", address: "Jose Julio Nieto, Pirque", stars: 4, ratingLabel: "Excelente", rating: 4.9, listPrice: 528908, price: 232720, discount: 56, image: cdn("21429425", "93689557007a3a8608b07598192eef91166d10d9.jpg") },
      { id: "6325487", name: "Renaissance Santiago Hotel by Marriott", address: "Avenida Kennedy 4700, Santiago", stars: 4, ratingLabel: "Excelente", rating: 4.5, listPrice: 528501, price: 285391, discount: 46, image: cdn("6325487", "b4129792926b0d07ded944040c8dd385f0242cdb.jpg") },
      { id: "9776413", name: "Courtyard Santiago Las Condes", address: "Avenida Kennedy 5601, Santiago", stars: 4, ratingLabel: "Excelente", rating: 4.7, listPrice: 599853, price: 329919, discount: 45, image: cdn("9776413", "12205b67679ccde4f8530206213d9a8eb2838622.jpg") },
      { id: "200094", name: "Sheraton Santiago Hotel and Convention Center", address: "Ave Santa Maria 1742, Santiago", stars: 4, ratingLabel: "Muy bueno", rating: 4.3, listPrice: 458069, price: 256519, discount: 44, image: cdn("200094", "a37044b5864a170b96662e9fadcdc1fbc95bd8ee.jpg") },
      { id: "574522", name: "Novotel Santiago Las Condes", address: "Av. Alonso de Cordova 5199, Santiago", stars: 4, ratingLabel: "Excelente", rating: 4.5, listPrice: 394727, price: 232889, discount: 41, image: cdn("574522", "1ba204eaf00eee520f7bd1339d01bc119605fd50.jpg") },
      { id: "564458", name: "Santiago Marriott Hotel", address: "Av Presidente Kennedy 5741, Santiago", stars: 4, ratingLabel: "Muy bueno", rating: 4.4, listPrice: 544077, price: 331887, discount: 39, image: cdn("564458", "4a33b78530d766ede0fd5bcc7258f4e73f0686c8.jpg") },
      { id: "21412733", name: "NH Collection Santiago Casacostanera", address: "Nueva Costanera 3900, Santiago", stars: 4, ratingLabel: "Muy bueno", rating: 4.3, listPrice: 376557, price: 229700, discount: 39, image: cdn("21412733", "6165c5daf143f75009eae12966b5f81a61bffc71.jpg") },
      { id: "38848761", name: "Ola Santiago Providencia, Tapestry Collection by Hilton", address: "Holanda 307, Providencia, Santiago", stars: 4, ratingLabel: "Excelente", rating: 4.7, listPrice: 313229, price: 197334, discount: 37, image: cdn("38848761", "8c8d480a3ea08135ab07f363b14b189e059e84d3.jpg") },
      { id: "2674257", name: "W Santiago", address: "Isidora Goyenechea 3000, Santiago", stars: 5, ratingLabel: "Muy bueno", rating: 4.4, listPrice: 529811, price: 339079, discount: 36, image: cdn("2674257", "ef8f9c9b7adf3f8f148d2a3aa1f3b9ee09b6257b.jpg") },
      { id: "17714108", name: "ICON Hotel", address: "Av. Alonso de Cordova 6050, Santiago", stars: 4, ratingLabel: "Muy bueno", rating: 4.3, listPrice: 279149, price: 184239, discount: 34, image: cdn("17714108", "d7e4d903e794fe6666fc16071534c8216e431180.jpg") },
    ],
  },
  {
    name: "Las Vegas, Estados Unidos",
    match: /las vegas/i,
    q: "US Navy Enlisted Recruiting, West Lake Mead Boulevard, Las Vegas, NV, USA",
    placeId: "ChIJCYN1ujrAyIARA1QZVtiGPBk",
    sorting: "DistanceToPoint-asc",
    checkedAt: "2026-10-28",
    checkedDates: ["2026-10-28", "2026-10-29"],
    hotels: [
      { id: "426550", name: "JW Marriott Las Vegas Resort & Spa", address: "221 N Rampart Blvd, Las Vegas", stars: 4, ratingLabel: "Excelente", rating: 4.5, listPrice: 964416, price: 704023, discount: 27, image: cdn("426550", "8dbef4a3b39d0c729a259a88ea3759233d692e3a.jpg") },
      { id: "529239", name: "Suncoast Hotel and Casino", address: "9090 Alta Dr, Las Vegas", stars: 4, ratingLabel: "Excelente", rating: 4.5, listPrice: 902857, price: 505600, discount: 44, image: cdn("529239", "84c9603886fe27bd9ebea6ef11af95ae8626cd09.jpg") },
    ],
  },
  {
    name: "Isla Margarita, Venezuela",
    match: /margarita/i,
    q: "Isla Margarita, Nueva Esparta, Venezuela",
    placeId: null,
    sorting: "DistanceToPoint-asc",
    checkedAt: "2026-10-28",
    checkedDates: ["2026-10-28", "2026-10-29"],
    hotels: [
      { id: "3516005", name: "Lidotel Margarita", address: "Centro Sambil Margarita, Av. Jóvito, Maneiro", stars: null, ratingLabel: "Excelente", rating: 4.5, listPrice: 219225, price: 190726, discount: 13, image: null },
      { id: "107629975", name: "Maloka Hotel Boutique & Spa", address: "Playa Guacuco, Arismendi", stars: null, ratingLabel: "Excelente", rating: 5, listPrice: 369911, price: 318124, discount: 14, image: null },
      { id: "108416529", name: "Cala Margarita Hotel Boutique & Spa", address: "Ranchos de Chana, Paraguachí", stars: null, ratingLabel: "Excelente", rating: 5, listPrice: 516424, price: 413139, discount: 20, image: null },
      { id: "4479570", name: "Ikin Margarita Hotel & Spa", address: "Calle El Melonal, El Cardón, Paraguachí", stars: null, ratingLabel: "Excelente", rating: 4.8, listPrice: 328263, price: 288871, discount: 12, image: null },
      { id: "30216346", name: "H2otel Boutique BY LD Hoteles", address: "Calle Miragua, Playa El Agua, Paraguachí", stars: null, ratingLabel: "Excelente", rating: 4.7, listPrice: 287911, price: 250483, discount: 13, image: null },
      { id: "107863966", name: "Hesperia Playa el Agua Todo Incluido", address: "Av. 31 de Julio, Playa El Agua, Paraguachí", stars: null, ratingLabel: "Bueno", rating: 3.8, listPrice: 199189, price: 171303, discount: 14, image: null },
    ],
  },
];

export function findBeloTravelDestination(text: string) {
  return beloTravelCatalog.find((destination) => destination.match.test(text));
}

const compact = (isoDate: string) => isoDate.replaceAll("-", "");

// Same URL the belo travel search page builds (the one shared as reference).
export function beloTravelSearchUrl(destination: Destination, checkIn: string, checkOut: string, adults: number) {
  const params = new URLSearchParams({ businessTrip: "false", dates: `${compact(checkIn)},${compact(checkOut)}` });
  if (destination.placeId) params.set("placeId", destination.placeId);
  params.set("propertyTypes", "1");
  params.set("q", destination.q);
  params.set("rooms", `${adults}-`);
  params.set("sorting", destination.sorting);
  params.set("stars", "4,5");
  params.set("currency", "ARS");
  return `https://travel.belo.app/search?${params.toString().replaceAll("+", "%20").replaceAll("%2C", ",")}`;
}

export function beloTravelHotelUrl(id: string, checkIn: string, checkOut: string, adults: number) {
  return `https://travel.belo.app/hotel/${id}?currency=ARS&s_room=${adults}-&s_dates=${compact(checkIn)}%2C${compact(checkOut)}`;
}
