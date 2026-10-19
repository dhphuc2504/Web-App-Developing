// Public editorial copy, deliberately separate from staff recipe instructions.
const stories = {
  "salmon-nigiri":
    "Gently seasoned rice is shaped into small bites and topped with silky salmon and a delicate touch of wasabi.",
  "shrimp-tempura":
    "Shrimp and seasonal vegetables are coated in a light batter, fried until crisp and served with dipping sauce.",
  "miso-ramen":
    "Springy noodles meet a warming miso broth, finished with pork, egg, greens and a fragrant garnish.",
  "seasonal-vegetable-bowl":
    "Roasted pumpkin and colourful vegetables are arranged over rice, with a light savoury dressing.",
  "salmon-teriyaki":
    "Salmon is gently glazed with teriyaki sauce and served with steamed rice, greens and pickled ginger.",
  "matcha-mochi":
    "Soft rice-flour dough is shaped around strawberries and finished with a light dusting of matcha.",
  "vegetable-tempura":
    "Seasonal vegetables are coated in a delicate batter and fried in small batches for a light, crisp finish.",
  "shoyu-ramen":
    "Soy-seasoned broth is poured over noodles and finished with pork, egg, nori and spring onion.",
  "garden-vegetable-bowl":
    "A colourful selection of vegetables is gently cooked and served over rice with soy sauce and sesame oil.",
};
export const preparationSummary = (slug) =>
  stories[slug.replace(/^demo-/, "")] || null;
