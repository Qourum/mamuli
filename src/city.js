// ===== ტფილისი in 3D: Tbilisi, one model of the whole city (Meshy's, from the board's concept picture) =====
// Inside the squares the whole city stands as one model (art/m_tb_city.glb, a phone's in art/mobile; made by
// tools/city_make.mjs): in the middle the old city with the Mtkvari through it, Mtatsminda's hill with its tower,
// Narikala with Kartlis Deda, the Old Town's roofs, the baths' domes, Sameba, the Peace Bridge; round it the ring of
// the districts, each tile behind its own square (a corner's tile shared by the two districts beside it). Each district
// is its own piece of the model: it greys when mortgaged, it jumps when bought. The model's height map (below) says
// where things go: boats on the river, eagles round the tower, the baths' steam. Along both banks of the river runs a
// road of two lanes (laid in the model too): cars, buses and minibuses drive both ways, stop at the crossings' traffic
// lights, jam now and then, and once in a while two of them crash. Freedom Square and the embankment's bench stand on
// their corners as models of their own; the traffic jam and Heroes Square's patrol are made here.
// A corner's frame is its square's: x along the side (to the right seen from its side), +z towards the board's edge.

const CityModels = (() => {
  const T = window.THREE;
  if (!T || typeof Models === 'undefined' || !Models || typeof Terrain === 'undefined' || !Terrain) return null;
  const { Builder, rng, PAL } = Models;
  const { box, cyl, cone, pyr, ball } = Models.shapes;

  const C = {
    cream: 0xe9ddc3, panel3: 0xd9d2c3, glass: 0x5b7889, glass2: 0x8aabbd, win: 0x39444f,
    wood: 0x7d5234, wood2: 0x5b3a24, balcony: 0x6b8f88, iron: 0x3a3c40, red: 0xc23a2e, white: 0xf3efe6, yellow: 0xe9c449
  };

  // ===== the model's top surface: its height on a grid over the inside (made by city_make.mjs; Terrain reads it) =====
  const HEIGHTS = /*HEIGHTS*/{"N":128,"half":4.6,"lo":-0.3,"hi":2.6,"top":[1.988,0.827,-2.623],"data":"HR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHiQjIyEgICAgIB4dHBwcHBwnHBwcHBwcHBwcHBoaGhoaGhoaGhoaGhoaGh4fHx4eHh4eHh4fHx8dHR0dHR0dHR0dHR0dHR0fHx8fHx8fHx8eHh4eHh4eHh4fHzxCREElJiMYGBkYGBgXFxcZHyIjIyMjIyMjIyIiKiIiIB0dHR0mJycnIyIhISIhHh0cHBwcMj8tHBwcMjAuNRwcGhoaGhoaGhoaGhoaGhoaHh8fOTk5OTk5OTkfHx4eHx8fICAgICAgIB8dHR8fHx8fHx8eHh4eKh4fHx8fHh4fPUJGQSUmJiIYGRgYKioqFxcjIyMjIyMjIyMjIzFCNSMjIB0dHSYnKD4xY2NkHx0bGVZWGhssOCc+OBw9OjxILBsZGhoaGhoaGhoaGhoaGhofHx42NjY+Pj42Nh4fHh4yKkJFRkBAQCsrIB5HTEYnHh4eHh5HTUpFHjBBQkAsHh49QkVBJSgoJRgZGBgpKSkpHiMjIyMjIyMjIyMjMEA1IyMiHR0dJicoNCpiYmMfNyJWVFYZGRsbJ0lBGycnJzIbGxUaGRkZGRoaGhoaGRkZGh8eHjY2NkBAQDY2Hh8eHio9Q0VAQEBAODkgHh1LT0oeHh4eHkVNTR4eL0FDQC8eHjxCRUEmKCglGBkYGCkpKSkeIyMjIyMjKyMjKjwjJyIhIyMdHR0lJycnJmJiYx47KVZUVBgZGRsbJiQbGxsbLE4bFBoaGRkZGhoaGhoZGRoaHx4fNjY2X19gNjYeHx4eMypCRUBAQEA4KyAeHUZMSh4eHh4eHkNFOh4vQUJALh0eMjA0NCcmJiIYGBgYGBcXFyMkIyMjIyMjIyMhKCwiIykjIxgdHSQmJSMiYmJjHBoZGFRWMi4ZGik5PD5OPzwbJRoUGh4aGRobGhkZGRofGxofMDAwMDBfX2AfHx4fHh4yKkJAQEBAQDgrIB44P0M/Hh4eHh4eRUgeHi81NTYvHR4xS1FLJiYmJCMYGRkYFxcXISMjIyMjKyQkIyErPC8hKTAjGh0dIyIgHx0bGhoZGBgYUCo/OSYaMEQxNjs3MRsbGhYZHxkZGhoaGhoaGh4aGh8uLi4uMF9fYB8fHh8eHjIrQkVARkBAOCsgHh1HRj4oHh4eHh5PQx4eLUVFQywrHjJLUUs1NTU1NTY2OTk5OTk5Nzc2JyMkJCQhICAgICA5QikaHR0hIB8dGxwcGBgnFxcuLC0sGRocHDI6UEwzHRsaGBkaGhoaGhoaGhoaGhoaHy4uLi4wYGBgHh8fHx4eMitCRUBGQEA4KyAeHUdJRh4eHh4eK09STB4vRUZDLh0eJUtRSzk5OTk5OTY0NDQ0NDQ0NDUmIyQkIyAgICAzOCgyIx0dHSAfVlYdGxsXM0Y0Kz47GBgZLyQcMk1YUTMdGxoXGhoaGhoaGhoaGhoaGhofHx8fHkBMTEweHh8fHh4xPUJFRkBAREA6IB44QEVBHh4eHh4eTVFOHi9CQkMeHR5LP1RLSSYmIBcXFxcXFxcXLC4vNSQjJCQjICEhICAnICMjHh0dH1ZWVlYZNDkyQjIXNzMYGCo+LBwyNk5LMxsbGxcaGhoaGhoaGhoaGhoaGh8fHx4eTExMTTU4Hx8eHjMfQkVGRkZEQDkfHjhMPSgeHh4eHh5FSkMeL0VJQy0dHkxMUUxMJiYhFxcXFxcXFxcXHR0dHSMkIyEhIiIgICEgIyMfHR0fH1ZWVlYyOSMXFxkXGBwcGSocHDA2OzcxGxsbFhoaGhoaGhoaGhoaGhoaHx8fHh4oSk0wNTgfHx4eHh4eHh4eHh4eHh4eQU9KJR4eHh4eSElGHh4vRUpDLh0eMEtRSycmJiIXFxcXFxcXFyoqKiYdIyMjISIiIiEgICArIx8dHR8fHlZWVjcYTxg4NS8YGRgZHBwcPD5NQDwbGxsWGhoaGhoaGhoaGhoaGhofHx8eHjIyMjUfHh8fHh4eHh8gICAgHx8fHx86SUkeHh4eHh5KTkweHjBFSUMlHR4vS1FLJycmIhcXFxcXFxcXKigoKSojIyMhISIiICAgICwjHx0dHiUwHVZIR1BOTjY4MBgYGRscHBwcHBwcHB4tGhYaGhoaGhoaGhkaGhoZGh8fHh4eNDIyNR4eHx8eHh4eHh8gIB4eHx8fHx46Hx4eHh4eHjxJRUAeL0FBQSgdHi8wNDQnJiYjFxcXFxcXFxcpKCgpKiMjIyEhICAgICAhIyMfHR0eMDssPDpIUE5OLSgZGS4vGxwpQhwcHBwcHjAbGRoaGhkZGhoaGRkaGhkaHx8eHh4eHh4eJy0fHx4eHh4eHh4fHh4fHx8eHh8gHh4eHx4ePEZGHh4uQUNAIR0ePUJGQSYmJiMXFxcXFxcXFyopKSgqIyMiISAgICAgLi4uLh8dHR0eMixKQzAbUEg6NBoaMzYbHClAHBwcHhwcGxsaGhoaGhkZGRkZGhoaGhsfHh4fHx4eHh4eKx8eHR4eHh4fHx8fHx8fHx4fHx8fHx8fHx8fPDoeHi9BQ0ApHR49QkVBJiYmIhcXFxcXFxcXFxcXIiIiIiIhISAgICYuLi4uHx0dHSxCPjgzGzg8GycjGxsbGxwcHBwfHBwcHBsbGhkbGhoaGhkZGRkaGhobGx8eHh4eIB8eHh4fHx4dHh4eHh8fHx8fHx8fHx8fHx8fHx8fHx8fHx4eKEFBQScdHj1CRkElJiYgFxcXFxcXFxceICEhISEhISEhICAgICAhISIeHR0bHDw3GxsbKy8bGxsbGxsbGxsbGxwbGxsbGhkYHRsaGhoaGhoaGhoaGxsaHR4fHh4eHh8eHh4fHhYdHh4eHx8mKx8fHx8fHx8fHx8fHx8fHi40Hh4dHR0dHR0dPUJFQSUlIxcXFxcXFxcXFx8iIiIzMiMiIiIiIiIiIzEuIhQdHRkZGRkZHBwcHBwZGR4eHx8fGh4eHh0dHR0cHBwcHBwcHBwcHR0dHRwcHB0dHh4eEBAQEBARERETHh4eHisyHjU4JB4eHh4eHh8eHh4dHR0dOD8lHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHRsWNzg4OTs+QUA9Ojg3NzcZGx0dIxkZGS0rKysrKysrKjE1MR4eHh4eHR0dHR0cHBwcHBwcHBwcHBwcHBscHB0eHhgQEBAQEREREhQeHh4eLTkoKy8uMh4eHyQoKSgmJCIfHR0mLB0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dGxk1NTU5Oz5BQD06ODU1NxkbHR0jGR4ZLCsrKysrKysqMTYxKx4eHh4dHSEdHR0dHR0dHR0cHBwcHBsbGhobHh4eFw8PEBARERESFR4eHh4eLzU1HTk+HR0lLjQ3NTQyMi0nIR0dLyYdHR0dHR0kNDEdJi8iMjQdHR0dHR0dHR0bGTU1NTk8PkFAPTo4NTU3GRwdHSMZGRkZGRkaGhksKyoxNjEsHh4eHh4eHR0fHh0dHR0dHR0eHR0cHhsdHh4eHh4VDw8QEBERERIWHh4ePDQrMzEoKC0dIy04PT4+Pj4+PDcuJi0/MR0dHR0lHS1AOx0zPC09QCsdJC0dMTUxHRsZNTU1OTw+QUA9Ojg1NTcZHB0dIBkZGiEZGRkaGSwrKjE2MS0eHx8eHh4eHh4eHR0dHR0dHR0dHR0dHR0dHR4eHhMPDxAQEREREhYeHi5IPTU5LUM6HSAqOUBERkxMRkZEQTszKTIoHR0dHTIqLTQuIiowIjAzHR0uOCU1ODUcGjU2NjY5PD5BQD06ODU1NTccHR0hIyQaIRkZGRkZLCsrMTYxLB4eJyceHh4eHh4eHh4eHh4eHh4eHh4eHh8fHh4eEw8PEBAQERESFx4eHjMpKzEoPzUdJjpBR05PUFZSUE1IQjs1KyAdHR0dIRxDSjUyPTAdHS0qHR0lKDA1NBwaNTU1Njk7PkFAPTo4NTU1NxsdHSAjJBoiGRkZGRksKysxNjEuHR4rKx4eHR4eHh4eHiAfHh4gHh4eHh4eHh8eHh4TDw8PEBARERIXHh4eOjsrNSYdHCI5QUhPUFBWVFRSUVBIQTw2Kh4dLiQdHTxEMDI8LicyQzsdHTg+PS8cHBo2NjU2OTs+QUA9Ojg1NTY3Gx0dICMkGiEZGRkZGSwrKzE2MS4dHh4eHh0dHh4eHh4gICAvICAgHh4eHh4eHx4eHhQODw8QEBEREhgeHi4/Py88KxwfNT9IUFFRVVRgVFRSUVBGQTw0JB0uIjZBNycdHSQoNy4/OSsdOUBEQjkcGhkZGRkZJycnJycnGRkZGRkbHR0hIyQaIRkZGRkZLCsrMTYxLR0eHh4eHh0eHh4gICAgMjM1MyAgIB4eHh4eHx4eFhEPDw8QEBERFx4eKj1FKyQcHCU6QkxRUlVUhrGwVFRSUU1EPzkpHRw7Q1JANDstHSEwKSQ1RUwjQENDMDMaGRkZGRknJycnJycZGRkZGRsdHSEiIxohGRkZGRksKysxNjEtHR4hHh4eHR4eHiAgIC0yTlFPMiAgIB4eIB4eHh4eFA4PDw8QEBEWHh4eRUI4KxwiLDtET1FTVF+HybFgVVVSUUdAOisfKSY6Qjs/Sjc4PTIzHTQ9RCw7PDE4OTYqGRkZGRkZGRkZGRkZGRkZGh0dISIjGiEZGRkZGSwrKzE2MS4dHh4eHh4dHh4eICAzMTBQVFJMLSAgICBGIB4eHh4WEA4PDw8QERQeHh5JPjYqHig4PUVQUVJTVFSHh1RVUlJRR0A5LB8wLxxBREM8Oj9FRkYxHSsdN0k5ODw8NzAZGRkZGRkZGRkZGRkZGRkXHR0hGSAaIRkZGRkZLCsrMTYxLB0eHh8eHh0eHh4gOE5OSlBTUC4gICAgSUsgIB4eHhYSDg4PDxAQEh4eHkA6MxwjLDk9RlBRUVJTVF9UVVJSU1JHQDcqHhwcHEVIRERHR0NBQSgxNB0sOS02Ojo5GxoWGhsbGhoaGhsbGxYWGxYdHSAaIBohGRkZGRksKysxNTEeHR4eHh4eHR4eIDFLUHF0dHBTNTIuIF5kYzQgHh4eFhMODg4PDxAQGh4ePz45MCQuOD1GUFFRUVJTVFZRUlNTUkY+NCcdHR0tQ0dER0pJRT4lHTI0HSwsLjg1ODEoHBkZGRwZGRkZGRkZGRkoHx0dGhkZGRkZGRkZGSwrKzE1MR4dHh4eIR4dHh4eLjJtdnp5dU82MzEvYXJnXh8fHh4WEg0ODg8PDxAXHh4eQDwwIis3PERNUVFVUVFTUVFSU1NQRj0wIyw0Kz9AQkJHS0pHPR0dHS8rQUIsMC0uHzQmGScZGRkZGRkZGRkkHTUrHR0TGxsbGxsbGhoaGxsbGxsbHB0eIB4eHh0eHi8xNG52e3t1UU42Mi9eZGNJIB4eHhYRDQ4ODg8PEBIeHh48NxweJTA6QUlQWFFUUVJRUVJTU0lDOioeLDYnOjs6QD9FR0YdHR06RzlAQCwxHBwbHRkhNCYgGRkZGRwZKDYjIhwdHRMbIBoaGhoaGhoaGhoaGhsbHR4eHh4eHR4eMExPUHJ2dnJTRUIzICBMNyAeHh4eGxANDQ4ODg8PEB4eHh0dHBsfJzg+RVdQV1BQUlFRUlJKST80JB0dHR0dIR0qHUA/HSwzJDVFNykqQUYyHBsZGRkfGRkZGRkZHCwZJxkZGx0dExsgGxoaGhsbGxsbGxoaGxsdHh4eHh0dHh4gUFRTU25uWVVSQT4gICAgIB4eHh4cEA0NDQ4ODw8QFR4eHhwcGhshQDk/RElPUVJRUVFRSklFRDw2Hh4dHR0dHR0dJScnOUMwHSwdLS8/Qy0cGxkmJRkaGhoaGhodKR0ZIiIbHR0TGhoaGhoaGxoaLRsbGxsbGx0eHh4eHR0eHjBOUlFMUlVZV1RDQCAgHx4eHh4eHh8QDA0NDg4PDw8RHh4eHRwZGUFFPkQ+QkVITFBQTUhIQ0VEPzkyHh4dHR0dHR0dJyctNyYdKyIvMx0mHBwbGTUzGiMjGhoaGhoZGhk1NBsdHRQaGhobLS4uLi0tLi4sGxojHR4eHh4eHR4eMjRMTENGUlZaVlJCPx8fHh4eHh4eHhEMDQ0NDg4PDxAeHh4cGxo2PEFFLDk8P0JESEZFREE7Pjs8Ox4eHh0dHR0dHR0dHR0eHjA/Mh0dHRwcHBsZJSIaGhoZGRkZGhkaGSorGx0dFBoaJCUpKSkpKUI8KiklJCEdHh4eHh0dHiAqMS4wM0FDVFhYSDk2Hx8fHh4eHh4eGgwNDQ0ODg8PDxQeHh4bGyg3PR4lLDc5PD5AQEA+OzA4OzMeHh4eHiUnKCkoHR0dHh4eKjkwHR0dHBwcGhkZGRoZGRoaGhkZGhwZGRobHR0UGxokJSkpKSgoR0ApKSUkGx0dHh4fHh0eHiAgICcxP0JSSUs3NCwfHh4eHh4eHh4dDg0NDQ4ODg8PER4eHhwbGBkZGh8lKzE1ODk6OjctIjo8Nh4eHh4qKisrKSgeHh4eHh4eHh0dHR0cHBwaGRkaGhkaGhoaGhkaGhkZMigdHRQbGhoaKSkpKChKRCkpHBogHR0eHh4eHR4eHh8gIC8vQENBNzk2Hx8eHh4fHx4eHh4RDA0NDg4ODw8QFh4eHh0bGhkZGx4jJystLy8sJy8vMzcdHh4eKiwsLCspJycmHh4eHh4eHR0dHBwcHBsZGRoaGRoaGhoaGRoaGSotHx0dFBsaGxoaGhoaGkxFGxoaGhsdHR8eHh0dHh4eHiAgICAwNC01OCAfHh4eHh4fHh4eHhQNDQ0NDg4PDw8SHh4eGxsbGxoZGh0eISIiIR8dMjQdHR0zMh4qKywtLCooKCckHh4eHh4dHR0cHBwcGhkZHBoZGhoaGhoZGRoZLDAbHR0VGhsaGxsbGxsbTEcaGhoaGx0dHh4eHR0eHh4eHiAfHx8fHzIfICAfHh4eHh4eHh4eHBENDQ0ODg4PDxAWHh4eGxsaGhscHB4pLC0qHh0dHR0dLzUyHicrLi4tKzQ1MigeHh4eHh0dHBwcHBwaGRkZGhkaGhoaGhoZHBkgHxsdHRYaHBsaGxobGhpNRxseGxsbHR0eHh4dHR4eHh4eHh4fHx8fHyAgIB8eHh4eHx4eHh4eEw0NDQ4ODg8PDxIeHh4bGxocHB4cHTI0Mi8eHh0dHR0eMB4qNjc7Ojc8QEVAOh4eHh4eHR0cHBwcHBoZGRkaGhoaGhkaGRwcGTUwGx0dFhsaGhoaGhsbGk1HGhobGxwdHR4eHh0dHh4eHh4eHh4eHh4eHx8eHh4eHh8eHh4eHh4ZEQ0NDg4ODg8PDxYeHh4bHhwcHyEtKyIdHR4eHR0dLB4eNkdJSUpKSk5SSklINTc4Hh0dHRwcHBwcGxkZGRkaGhoaGhkZGRkZKicdHR0WGRkZGRkZGRkZTUYaGhoaGh0dHh4eHh0eHh4eHh4eHh4eHh4eHh4eHh4eIB4eHh4eHh4TDg0NDg4ODg8PER4eHh4bHBwcHC4uJyQdHh4dHR0zMERISlxSU1RVV1hXUEk2Oz02HR0cHBwcHBwcGhkZGRkZGRkZGRkZGRkZGRodHSAgICAgICAgICFMRiAgISEgHR4eHR0kHR4eHh4nHh4eHh4eHh4eHh4eHiAfHh4eHh4eHhoRDQ0ODg4ODg8PEx4eHhwbHBwcGx0gHR0eHh0dLjNGSE1cYmJgVFZXWFlUUjQ5OzUcHBwcHBwcHCAZGRkZGRkZGRkZGRkZGRkZGh0dICAgICAgICAgIEtEIEBAQCAdHh0dHS0pHh4eHTEuHh4eHh4eHh4eHh4eHh4eHh8eHh4eHhQNDQ0ODg4ODg8PFR4eHhscHBwcHBwcHR4eJR00RkhMTV5hY2RXWFpgY2RhWUdHRz48LTU3HBwcFhkZGRkZGRoaGhoZSRkZGRoaHR0gOTk5PDw8PDwgSUIgQEBAIB0eHh4eIx4eHh4eLCkeHh4eHh4eHh4eHh0eHh8eHh4eHh4eGxENDQ4ODg4ODw8QHh4eHhocHBwcHR0dHSsuNEZHSFJQTVhiZ2ttbW1sbGxrZl9XV1BIP0g8NBwWGRkZGRkaGhsbG1oZGRkaGhodHSA5OTk8PDw8PCBFPiBAQEAgHR4eMjwoNC8eHh4eHh4eHh4eHh4eHh0dHR4eHh4eHh4dHh4eEw0NDQ4ODg4ODw8RHh4eGxscHBwcHR0pLjJFRkdLUFVobW1tbW1tbW1tb2xsZ2VkWVRWSkpFHBcaGRkZGRobGxtfGxoZGRoaGh0dIDk5OTw8PDw8Pz86IEBAQCAdHx4yPDNGPR4eHh4eHh4eHh4eHh0dHR0cHh4eHh4eHR0eHh4bEA0NDg4ODg4ODw8THh4eGxscHBwcHCsuPUZHSUxobnJycXGDb26AbW1tbnd1ZmVhXmFfVUkcFxoZGRkZGhsbTBsbGhkZGRoaHR0gS0tLS0tLS0sgICAgQEBAIB0hHx4jJTw0HiAeHh4eHR4eHR0dHR0dHR0eHh4eHh0dHR0eHh4SDQ0NDg4ODg4ODxEeHh4cGxwcHBwcKS1ER0dManJ9l5aGhYSFhYWDbm2Vj5KOampoaWVWSBwXGhkZGRkaG18bGxsaGRkZGhsdHSBJS0tJS0tJSSAgICBAQEAgHSIeLjExHh4eHh4eHh4dHR0dHR0dHR0dHRweHR0dHR0dHR4eHhsPDQ0ODg4ODg4ODxQeHh4bGhwcHBwtNUZHS2Bwc5iTk5d1dHR0dHR/gJKPj5RsbGppaWRCHBYaGRkZGRoaGxsbGhkZGRkaGx0dIEpJSUlJSUlJICAgIFVUVCAcIR4tLy4eMTY3Mh4eHR0dHR0dHR0dHR0dHB0dHR0dHR0dHR4eHhINDQ0ODg4ODg4PEh4eHhsbHBwcLTJCR0hLZnFzmJOTlXV1dXV1dXV1lpCPlGxtbGllYRwcFhoZGRkZIRogGiAgGRkZGRkbHR0gICAgICAgISEhICAgVFNTIBweHh4ePTw3NB4eHh4dHR8dHR0dHR0dHRwcGx0dHR0dHR0dHh4eGw8NDQ4ODg4ODg4RHh4eHBscHBwvNEVIVVVmcXNzgYh1dXV1dXV1dXV1lZNtbW5ta2BKRBwWGhkZGRscKRwcHBwbGhkZGRsdHSEgICAgICEhISEhICBVU1UgHB0dHR05PToeHh4eHR0dHR0dHR0dHR0dHRwcGx0dHSQqIx0dHh4eEg0NDQ4ODg4ODhAWHh4eHBscHDE0R1BaZmhvdHZziHV4d3p5d3V3dnV1dG9tbWxpVkpIHBYaGRkZGhoaGhoaGxoaGRkZGx0dISIjISAhISEhISEhIEJAICAcHBwdHR0xHh4eHh0dHR0dHR0dHR0dHBwcHBwcGx0dHSYdHR0eHh4cDQ0NDg4ODg4ODhUeHh4cGxwcLjRHU19oaG1yc3OJjHd3dXd1dXd3eHV1cW5taVxWSkgcFhoZGRkZGRkZGRkZGRkZGRkbHR0hPkFBICEhISEhISEgQ0MgIBwcHB0eHR0eHh4eHR0d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HR0dHR0dHR0eHhYQDw8ODg4NDQwOHh4eGxoaGh4eHh0dIh0cGRkZG0RCQiknKi8vLzk5OTkbOTUyJxoZGRccMjYzLxsbGxscGxogNDc1MB0dPkRFPh8oHx8fHx8fHzk8OB8dHR0dHScdJysdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHh4eFg8PDw4ODg0NDBAeHh4bGhoaHR4dHSksKxwcGRkZGz46HyQdKBwcOjk5ORsbMicZGRkZFxs0NjQvGxscHBwbGx4zNzUwHR0+RUY/ICkhISEhISAgHx8fHx0dHR0dKTEyIR0dMR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0eHh4WDw8ODg4ODQ0MER4eHhoaGh0dHh0pLjIvKhwbGxkZGyQmKDQ1NTUbOTk5MxsaGRkZGRkWGzI2My8bGxsbGxsbIDM3NTAdHRchIB8fJx8gHx8fHx8fHx8fHR01Oz49NTpAQDo3NB0dHR0dHR0dHSMdHR0dHR0dHR0dHR0dHR4eHhUPDg4ODg0NDQ4YHh4eGhoaHR0sKykuMi8rKRsbGxkZGiYlNjY2Nhs0MzIZGRkZGRkZGBYbGxsbGxsbGxsbGxscHSAdHB0dHBwcHBwcNTU2NTU1HBooKycdHTQ8QD88QkNEQDUvOjQdHR0dHR0iNSsdHR0dIx0dHR0dHR0dHh4eFA4ODg4NDQ0NEBoeHh4aGhsdLjAvKyotKyorKhoaGhoZGRw2Njc2GxsZGRkZGRoaGhkYFhocHBwcHBwcHBwcHDUcHBwWHR00OD09OTQyMjIyMjIdHSgrJh0dHTw+PTw8Q0NAHR09OjYdHR0dHR0sIh0dIyktLSgpHR0dHR0eHh4TDg4ODQ0NDQ0QGx4eHhoaHiwxNjIuHikqLzEuKhoaGhoZGhobGxoZGRkaGhoaGhodGxoWGRkZGRkZGRkZGRkZGRkZGRodHTQ4PT05NDMzMzMzMxsYGBgdHR0dHTI7PDs7PTkdQD8+OzYdHR0dHR0dKDAxOispJSMdHh4dHR4eHhEODg0NDQ0NDREcHh4ZGhodKzAzMS0sKyswNC8qHxoZGRkaGhoaGRkZGhoaGhobGyIiHBYZGRkZGRkZGRkZIhkZGRkZGh0dNDg9PTk0KhkZIyMZLjM2MSwXGxsZKzk/PzwXFz4/QUA+OjQxFhcaGhgmMjE7PCspHikfIBscHh4YEA4ODQ0NDQ0NEh4eHhkZGh0dLC4tLjExLS0vLSgZGRkZGRkZGRsZGRkaGhoaGzA4Nh0aFhkZGRkZGRkZGRkgLzQxNBkaHR00OD09OTQrGRklJRouMzYxLBcaGhkyOj08Oxc2Oz9AQT89Ojc7GhkWFhwuKzExNCseKSUjIB4eHhYODg4ODQ0NDQ0SHh4eGRkaHR0dKyswNTQvKyoaGRkZGRkZGRkZGRkZJSsaGhsbODw8ODEWGRkZGRkZGRkZGRkwMjQzGRodHTQ4PT05NBoZGRkaGi4zNjEsFxoaLzEYOTYxFxc5PT9AQD89Ojw9GhcWLUM1GDI1LycrKiogHh4eFA4ODg4ODg0NDRMeHh4bGRwdHR0dHi0wMCwcGxoZGRkZGRkZGRkZGRkxPywbGxs5P0A9MRYZGRkZGRkZGRkZGTA3OTYZGh0dNDk9PTk0GhkZGRoaMzM2NSwXGhk3OxgXMxcXFyw5PD5AQD89PDs5FxYlOTUqNDArKCooHB0eHh4TDg4ODg4ODg0NEx4eHhwaHR0dHR0dHisrHBsbGhoZGRkZGRkZGS8tGSozIhsbGjc/Pz4bFxkZGRkZGRkZGRkZMDo8OBkbHR00OD09OTQaGRkZGRkuMzYxLBcaGRgYGBgXFxcXFxc3PD5AQD89OjQXFxgYPDo4MiopIycjHR4eHhIODg4ODg4ODg4THh4eGRkeHh4dHR0dHR0cHBsbGhkZGRkZLyoZLCoaGhsbGRkaGjk8ORwXGRkZGRkZGRkZIygwOjw4GRsdHTQ4PT05NCsnGScnJy4zNjEsFxoZGBgYGBcXFxcXMTc4PD5AQD89OzUXFxgyMCswJyoiHR0fHh4eJicoKCgoKCgnJyUgHh4ZHh4eHh4eHR0dHBwcGxsbGhoaLzAxLxkZGhoaMS8zGho1MjcbGxgZGRkZGRkZGRkhJzA6PDgZGx0dNDg9PTk0JycaJiYmLjM2MSwYGhklLhgXFxcXFzg8Ozo4PD5AQEA+OxgYGCQvKSsoJB4eHhoeHh4mJygoKCgoKCcnJSQeHhofHx8fHx4eHh0dHBwbGxsbGxofMDIvGhoaGjI4ODc7OjUyGxsbGBkZGRkZGRkZGRkZMDo8OBkbHR00OD09OTQaGxsbGxsbGxsbGxcaGR0lGBcXFxc4PD4+OjQ4PD9AQD8/GBkZGR8uJiQeHh4aGx4eHiYnKCgoKCgoKCclIx4eHysrHx8fHx8eHh0dHhwcGxsbGxssLxoaGhYXMjk5Nzw7MRoaGxsYGRkZGRkZGRkZGRkZGRkZGhcdHRscHBwcHBscHB0cHBsbGxsZFxoZLjEYGBcXFz0+Pj06Fy05Pj9AQRsZGRoaGxwdHR4eGhocHh4eJicoKCgoKCgoJyUgHh4tMTEuIC0wLyseHh0dHBwcHBwbGxsaGhoVFhcXNjU1KjMaGhoaGhcWFhYXFhcWFxcXFhcXFhcXFh0dEhscHBsbGxsbGxsbGxsbGxwXGhkxOTk3LRcXFz89OjEXFzM5PUAbGRkaGhsbHB0eHhoaGhseHh4TDw8PDw8PDg4PEx4eHi8zNTArMTYzLh4eIikcHBwcHBwcGxsaFRUWFxcYNzgoGRkZGRkaFx0dHR0dHR0dHBwcHR0dHR0XHR0SGxwcGxsbGxsbGxsbGyMiHBYaGTM6PDgxFyUXFzs0FxcXFzM7GxkaGBgaGxscIBkaGhodHR4eHhQPDw8PDw8PDw8THh4eLDAxLiswMjEtHh4rOCglHBwcHBwcGhUVFRYWFzc+PjoZGRkZGRkWHR0dHR0dHR0cHBwdHR0dHR0dHRMbHBwbGxsbGxscGxsbIyIcFhoZGDk5OBgmLi8uJhcXFxcbFxcbGhkaGBgYGBgnJRoaHR0fHh4eFQ8PDw8PDw8PDxIXHh4fKysgICstKx8fHh4nKCYdHBwcHBYVFSkxLTQ0MD9BPhgtJxgYGBYdHR0dHR8gHRwdHR0dHR0dHR0dEhscHBsbGxsbGxwcHBsjIhwWGhkYMTIuJRguMjAqKhcXFxcXFxgYGRobGBgYGCMgGh0dHR0dHh4XEA8PDw8PDw8PERUeHiwwMS4gKywrHx8eHiQkHR0cHBcWFRUqMzU0NTczPj49MzQxKRgWFh0dOT08NR0dHB0dHR0dHR0dHR0RGxwcHBsbHBsbHBwbGxsbHBUZGRgbJy0rGCwvLiwqFxcXFxceHxgZGhscHBsbGzEcHR0dHR0eHh4SDw8PDw8PDw8QFR4eKzM2MCswMjEsHh4eHR0dHRgXFhUVFBUyNjUzNDIXOTUzNjMWFxYWHR06PTw5HR0cHR0dHR0dHR0dHRIbHBsbHBwcHBscHBsbGhkcFBcZGBgYKyklLCglFxsXFxcXFxcXGBkaGxwcGxscOTo5MR0dHR4eHhMQEBAQEBAQEA8UHh4oMDEuKzE2My4eHh4dHRgjFhYbFRQUFBsxMy4rIi43OTYwFRUUFhYdITo9PDkdHRwdHR0dHR0eHR0dERscGxsbGxsbHBscGxsZGRwUFhcYGCwXFx4lHRsoNzMXFxcXFxgYGRobHBwcGxw5PDo0HR0dHh4eFRAQEBAQEBAQEBQeHh4rKx8fLTAvKx4eHR0XIDEkFRoVFBQUGRozFRUpKjg7OTMTFBQWFh0dOj08OR0dHB0dHR0dHR0dHR0RGxsbGxsbGxsbGxsbGxsbGxUUFRYXFxcXFxcpLyxDPBcXFxcYGBgZGhsbHBsbHDA5OB0dHR4eHh4ZEBAQEBAQEBAQEx4eHh8fHx8fIR8eHh4dFhUVIxQUFBQUGxgUFBUVFRUVNTY3EhMUFRYWHR06PTw5HR0cHR0dHR0dHR0dHRIbGxsbGxsbGxsbGxsbGxscFRUVFRUVFhcXGBwiGCcYGBgYGBkZGRobGxscGxsbGzIbGxwdHR0eHhsQEBAQEBAQEBARHh4eHx8fHx8fHh4eHRsUFBQUFBQUFBQUFBQUFBUVFRQUMRISExQVFhYdHTo9PDkdHRwdHR0dHR0dHR0dERtRUhs+Phs+Gxs+PxtRURwVFRUVFRUVFRYXGRoaGhoaGhoaGhobGxwcHBsbGxsbGxsbGxsbHB4eHhAQEBAQEBAQEA8UHh8fHx8fHx4eHh4dFBQUFBQUFRQWFBQUFBQUFRUYFBQSEhMUFBUWFh0dOj08OR0dHB0dHR0dHR0cHR0SG1JSGz4bGz4bGz4bG1JSHBUVFRUVFRUVFRUWGBkaGxscHBwcHBwcHBwbGhoaGhoaGhoaGhobGxsVEREQEBAQEBAPDxEcHh4eHh4dHR0cHBQUGBQWFBQUFBQUFBQUFRUVFRUUExMTExQVFhYWHR0dHR0dHR0cHR0dHR0dHRgdHRMcGxsbGxsbGxsbGxsbGxwbFRUVFRUVFRUVFRUVFRUVFRYWFhYXFxcXFxYXGRwcHB0dHR0dHR0cERERGhgWFxAQEA8ODhESExQUFBQUFBQUFBQUFBQUFBQUFBQVFRUVFRUVExMTFBQVFRYWFhYcHR0dHR0dHRwcHB0hIR0dFR0dEx0dHR0dHR0dHR0dHR0cHRwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcOTYcHR0dHR0dHR0dHR0dHR0dHCYwNTc5OTg3NC0eHRwgICAgICAgHx8fHx4ZICAgICAgICAgICAgIBkcHRwcHBwcHBwcHR0YHR0dHR0dHR0dHR0cHBwVHR0THR0dHR0dHRsaGigbHR0bHCMjIyMjIyMjIyMjHBwgHBwcHBwcHBw6NxwdHBoaGhoaGhoaGhoaGx0cIi8dHBwcODccHx4eHiBAQ0VHSUhGREE/IBkeKioqKiorKyMnIiMfGR4cICA2NjY2Nh4dHR4dHR0dHR0dHR0dHB8fHBUdHRUdHR4dHR0eHBsbKykbHRscLC44OTo7Ojk3LyscHBwcLS4uLR0cHBwcHBkcOzo6Ojo6Ojo6OjocHRwiLxwcHBw4NhweHh4eIEBCRUdJSEZEQT8gGh4qKioqKisrKioqKioZMzUzNDY2NjY2ODY2Hx0aGhoaGhoaGhscHR0cGB0dGB0dHh0dHB4dGxsbGxodHBwsLTg5Ojs6OTcvKxwcHC0wNzczLh0cHBwcGhw7Ojo6Ojo6Ojo6OhsdHB8vHR0cOTg3HB4eHh4gQEJFR0lIRkNBPyAaHioqKiofKysqKioqKhkzNTM0NjY3Nzc4NjYfGxkZGRkZGBgZGRoaGhoZHR0ZHh4dHR0dHR0dHBsbHhwcHCwtODk6Ozo5Ny8rHBwcLjg8PjsxLRwcHBwbHDs7Ozs7Ozs7Ozs7Gx0cHy8dHRw5ODccHh4eHiBAQkVHSUhGQ0E/IBseKioqKhoaGioqKioqGDM1MzQ2NjY3Nzg2Nh8cGxsbGxsaGhobHB0dHRodHRgeHh4eHR0dIh0dHRsaHRwcJSUlGBgYLBwlJSUcHC0wO0BBPDYtHCAhHBscGhoaGhoaGhoaGhobHRwjLzUdODk4NzMtHh4eIEBCRUdJSEVDQT8gGx4bGxsaGhoaGhobGx0YHRwcIDY2NjY2PUNAHxwbGxsbGxsZGSUcHR0dGx0dGB4eHh4eHiIiIh0dHBsdHBwiIhwYGBgdHCEbGxscHC44PD07MS0cHyIcGxwaGhoaGhoaGhoaGhsdHCQsHR0cOTg3HB4eHh4gQEJFR0lIRkNBPyAaHhscGB0YHBsYGB0dHBkdHBwgICAgICAgHR0fHBsjIyMjGxkkMh0dKSEcHR0XHh4eHh4iIiIeHR4oHR0cHBsbGxoYGBobGxsdGxwcLTA3NzMuHBwhIRwaHBoaGhoaGhoaGhoaGx0cIy8dHRw5ODccHx4eHiBAQkVHSUhGQ0E/IBkeGRwYGxgbGhgYGxwdGB4cHBwcHBwoKB0dHR8cGyUlJSUZGRsdHR0xJxwdHRYeHh4eIiIiHh4eHiwoHRsZGRobGxoYGxsZGRkbHB8cLS4uLRwcJxwjHBkcGhoaGhoaGhoaGhobHBwfLx0dHDk4NxweHh4eIEBCRUdJSEZDQT8gGR4lJRgYGBgYGBgYHR4YHhwcHBwcHR0dHR0dHxwbGxsbGxkaHR0dHR0dHB0dFx4eHiIiIh4eHh4eHh0dGhkZGBkZGhoZGRkYGRwcHB4cHR4dHBwcHBwcGRwtLS0tLS0tLS0tLS0cHB8vHh4yOTg2Hx8eHh4gQEJFR0lIRkRBPyAZHiUlGCwsLCwYGBwZHBkpLTArHB0dHR0dHR0fHBsbGykbGRodLCkdHR0ZHR0XHh4iIiIeHh4eHh4eHR0cHBsaGhobGxwcHBwcHBwcLS0tLS0cHBwcHBwXHCwsLCwsLCwsLC0sLRwcJjA1Nzk5ODceKx4eHiAhISEhISEhISEgIBgeJSUYLCwsLBgaKx8cFyktMCscHR0dIikpKh8cHCMjGxsZGh0hHR0sLBYdHRYeHiIiHh4eHh4eHh4eHRwdHBwcHBwcJSUcHBwcHCEcHh0dHRwcHB4cHxYcLCwsLSwtLSwsLCwuHBwgHh4dHCgdHh4eHh4eICAgJCIiICAgICAgGR4lJRgaGhoaGBgnHR0XKS0wKxwdHR0iKSgqIRwcIyIcGxoaHR0dHSYmEx0dFR4eHh4eHh4eHh4eHh4dHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcFhwtLS0tLi4uLi4uLi0cHCEeHh0dHB0eHh4eHh4gMDAkISEhITAwISAXHhgYGBgYGBgYGBgYHRcpLTArHSAdHSIeIR4fHBwcHBwcGhsdHSkdHR0RHR0dHh4eHh4eHh4eHh4eHh0aHBwcHBwcHBwcHBwcHBwcHBwcHBwcHSAgHBwWHBwcHBwcHBwcHBwcHBscHh4eHh4eHh4eHh4dHiAgICAgICAgICAgIBckHh4eHh4eHh4eHh8dFx8cHR0dHR0dHh0eHR8cHBwgIBwaGx0dLR0dHR0dHR0dGR0dHR4eHh4eHR0bFhUYGxwcHBwcHBwcHBwUExoaGhoaGhoaGRcUHR0SExQUFR0dFBUYFxYXFxYWFhkbGxobGxsbGxUVHR0dHh4eHh0dHRwZFhUVHB0dHR0dHR0dGhYVFBgeHh4eHh8fHh4YFhYaGxwcHBsbHR0dHBUdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHQ=="}/*HEIGHTS*/;
  const WATER_Y = -0.143;                                   // (the river's surface)
  // its highest point (the tower on Mtatsminda), and a few places in it (board coordinates, x to the right and z to the
  // front seen from the front)
  const TOWER = HEIGHTS ? [HEIGHTS.top[1], HEIGHTS.top[2]] : [0.83, -2.62], TOP = HEIGHTS ? HEIGHTS.top[0] : 2.0;
  const CENTER = { peak: TOWER, baths: [0.83, 2.77], baths2: [1.22, 1.85] };
  const BOARD_MODEL = { url: 'art/m_tb_city.glb', top: TOP };
  // the Mtkvari's two embankments' roads, laid in the model by city_make.mjs (city_mends.mjs): their middle lines from
  // the back of the city to its front (x, z), half a road's width, a lane's middle from the road's (right-hand traffic),
  // the crossings (a zebra, a stop line 0.045 before it either way)
  const ROADS = /*ROADS*/{"y":0.036,"half":0.085,"lane":0.0375,"river":{"west":-1,"east":1},"crossings":[{"road":"west","z":-2.05},{"road":"west","z":0.34},{"road":"east","z":0.34},{"road":"east","z":2}],"west":[[-1.268,-3.3],[-1.281,-3.25],[-1.294,-3.2],[-1.307,-3.15],[-1.319,-3.1],[-1.329,-3.05],[-1.337,-3],[-1.341,-2.95],[-1.341,-2.9],[-1.337,-2.85],[-1.327,-2.8],[-1.314,-2.75],[-1.298,-2.7],[-1.282,-2.65],[-1.266,-2.6],[-1.251,-2.55],[-1.239,-2.5],[-1.23,-2.45],[-1.226,-2.4],[-1.225,-2.35],[-1.225,-2.3],[-1.225,-2.25],[-1.224,-2.2],[-1.221,-2.15],[-1.216,-2.1],[-1.209,-2.05],[-1.2,-2],[-1.19,-1.95],[-1.178,-1.9],[-1.165,-1.85],[-1.15,-1.8],[-1.133,-1.75],[-1.115,-1.7],[-1.096,-1.65],[-1.075,-1.6],[-1.054,-1.55],[-1.031,-1.5],[-1.008,-1.45],[-0.983,-1.4],[-0.958,-1.35],[-0.933,-1.3],[-0.907,-1.25],[-0.881,-1.2],[-0.854,-1.15],[-0.828,-1.1],[-0.801,-1.05],[-0.775,-1],[-0.748,-0.95],[-0.723,-0.9],[-0.697,-0.85],[-0.673,-0.8],[-0.648,-0.75],[-0.625,-0.7],[-0.603,-0.65],[-0.581,-0.6],[-0.56,-0.55],[-0.541,-0.5],[-0.522,-0.45],[-0.505,-0.4],[-0.488,-0.35],[-0.473,-0.3],[-0.459,-0.25],[-0.447,-0.2],[-0.435,-0.15],[-0.426,-0.1],[-0.417,-0.05],[-0.411,0],[-0.406,0.05],[-0.402,0.1],[-0.401,0.15],[-0.401,0.2],[-0.402,0.25],[-0.405,0.3],[-0.41,0.35],[-0.416,0.4],[-0.424,0.45],[-0.433,0.5],[-0.444,0.55],[-0.454,0.6],[-0.465,0.65],[-0.474,0.7],[-0.483,0.75],[-0.491,0.8],[-0.496,0.85],[-0.5,0.9],[-0.502,0.95],[-0.502,1],[-0.501,1.05],[-0.5,1.1],[-0.499,1.15],[-0.498,1.2],[-0.497,1.25],[-0.498,1.3],[-0.5,1.35],[-0.503,1.4],[-0.507,1.45],[-0.512,1.5],[-0.518,1.55],[-0.524,1.6],[-0.53,1.65],[-0.537,1.7],[-0.545,1.75],[-0.552,1.8],[-0.56,1.85],[-0.568,1.9],[-0.575,1.95],[-0.583,2],[-0.59,2.05],[-0.596,2.1],[-0.602,2.15],[-0.607,2.2],[-0.611,2.25],[-0.615,2.3],[-0.617,2.35],[-0.618,2.4],[-0.618,2.45],[-0.617,2.5],[-0.614,2.55],[-0.61,2.6],[-0.605,2.65],[-0.599,2.7],[-0.591,2.75],[-0.583,2.8],[-0.575,2.85],[-0.565,2.9],[-0.555,2.95],[-0.545,3],[-0.534,3.05],[-0.524,3.1],[-0.513,3.15],[-0.502,3.2],[-0.491,3.25],[-0.481,3.3]],"east":[[-0.356,-3.3],[-0.374,-3.25],[-0.389,-3.2],[-0.401,-3.15],[-0.411,-3.1],[-0.419,-3.05],[-0.424,-3],[-0.428,-2.95],[-0.429,-2.9],[-0.429,-2.85],[-0.427,-2.8],[-0.423,-2.75],[-0.418,-2.7],[-0.411,-2.65],[-0.403,-2.6],[-0.394,-2.55],[-0.384,-2.5],[-0.373,-2.45],[-0.361,-2.4],[-0.348,-2.35],[-0.334,-2.3],[-0.319,-2.25],[-0.304,-2.2],[-0.287,-2.15],[-0.27,-2.1],[-0.252,-2.05],[-0.233,-2],[-0.213,-1.95],[-0.192,-1.9],[-0.17,-1.85],[-0.147,-1.8],[-0.124,-1.75],[-0.099,-1.7],[-0.074,-1.65],[-0.048,-1.6],[-0.02,-1.55],[0.009,-1.5],[0.039,-1.45],[0.072,-1.4],[0.107,-1.35],[0.143,-1.3],[0.179,-1.25],[0.214,-1.2],[0.248,-1.15],[0.28,-1.1],[0.309,-1.05],[0.335,-1],[0.357,-0.95],[0.377,-0.9],[0.395,-0.85],[0.412,-0.8],[0.429,-0.75],[0.445,-0.7],[0.461,-0.65],[0.476,-0.6],[0.49,-0.55],[0.504,-0.5],[0.518,-0.45],[0.53,-0.4],[0.542,-0.35],[0.554,-0.3],[0.564,-0.25],[0.574,-0.2],[0.583,-0.15],[0.591,-0.1],[0.598,-0.05],[0.604,0],[0.61,0.05],[0.614,0.1],[0.617,0.15],[0.62,0.2],[0.622,0.25],[0.623,0.3],[0.623,0.35],[0.623,0.4],[0.622,0.45],[0.62,0.5],[0.617,0.55],[0.614,0.6],[0.611,0.65],[0.607,0.7],[0.602,0.75],[0.597,0.8],[0.591,0.85],[0.585,0.9],[0.579,0.95],[0.572,1],[0.565,1.05],[0.558,1.1],[0.55,1.15],[0.542,1.2],[0.534,1.25],[0.526,1.3],[0.518,1.35],[0.509,1.4],[0.501,1.45],[0.492,1.5],[0.484,1.55],[0.475,1.6],[0.467,1.65],[0.458,1.7],[0.45,1.75],[0.443,1.8],[0.436,1.85],[0.43,1.9],[0.425,1.95],[0.42,2],[0.413,2.05],[0.406,2.1],[0.4,2.15],[0.395,2.2],[0.392,2.25],[0.392,2.3],[0.396,2.35],[0.401,2.4],[0.406,2.45],[0.411,2.5],[0.414,2.55],[0.417,2.6],[0.419,2.65],[0.421,2.7],[0.423,2.75],[0.425,2.8],[0.428,2.85],[0.431,2.9],[0.436,2.95],[0.442,3],[0.449,3.05],[0.458,3.1],[0.468,3.15],[0.481,3.2],[0.496,3.25],[0.514,3.3]]}/*ROADS*/;
  const ROAD_Y = ROADS && ROADS.y || 0.036;                 // (the roads' surface, as laid in the model)

  // ===== pieces (the corners', the moving things', the players' houses) =====
  // a window or a band of windows: a thin dark pane just in front of a wall facing +z
  const pane = (w, h) => new T.PlaneGeometry(w, h).translate(0, h / 2, 0);
  // a car facing +x: a saloon (0), a hatchback (1), a jeep (2), a taxi (3, its sign on the roof); its roof its colour
  // (seen from above), headlights and red lights behind
  function car(B, x, z, ry = 0, c = C.red, s = 1, type = 0) {
    const put = B.at(x, z, ry, s), tall = type === 2 ? 1 : 0;
    const L = 0.075 + tall * 0.003, bh = 0.022 + tall * 0.006, cw = 0.042 + (type === 1 ? 0.006 : 0) + tall * 0.008, cx = type === 1 ? -0.01 : -0.004 - tall * 0.003;
    put(box(L, bh, 0.036 + tall * 0.002), c, 0, 0.008, 0);
    put(box(cw, 0.018 + tall * 0.003, 0.032 + tall * 0.002), C.glass, cx, 0.008 + bh, 0);
    put(box(cw - 0.006, 0.003, 0.03 + tall * 0.002), c, cx, 0.026 + bh + tall * 0.003, 0);
    for (const [wx, wz] of [[-0.024, -0.018], [0.024, -0.018], [-0.024, 0.018], [0.024, 0.018]]) put(box(0.016 + tall * 0.002, 0.016 + tall * 0.002, 0.006), 0x222222, wx, 0, wz * (1 + tall * 0.06));
    for (const wz of [-0.012, 0.012]) { put(box(0.003, 0.006, 0.008), 0xfff3c4, L / 2, 0.016, wz, { vary: 0 }); put(box(0.003, 0.006, 0.008), 0xb3241c, -L / 2, 0.018, wz, { vary: 0 }); }
    if (type === 3) put(box(0.012, 0.007, 0.018), C.white, cx, 0.029 + bh, 0, { vary: 0 });
  }
  function bus(B, x, z, ry = 0, c = 0x3f7fc2, len = 0.17, s = 1) {
    const put = B.at(x, z, ry, s);
    put(box(len, 0.05, 0.045), c, 0, 0.008, 0); put(box(len * 0.92, 0.016, 0.047), C.glass, 0, 0.032, 0); put(box(len * 1.01, 0.008, 0.046), C.white, 0, 0.058, 0);
    for (const wx of [-len * 0.32, len * 0.32]) for (const wz of [-0.02, 0.02]) put(box(0.02, 0.016, 0.006), 0x222222, wx, 0, wz);
  }
  const minibus = (B, x, z, ry = 0, s = 1) => { bus(B, x, z, ry, 0xf2f0ea, 0.085, s); B.at(x, z, ry, s)(box(0.086, 0.006, 0.047), C.yellow, 0, 0.024, 0); };
  // the cars stuck in the traffic jam, one lane after another
  function jam(B, x, z, n, ry = 0, gap = 0.1, seed = 1) {
    const r = rng(seed), cs = [C.red, C.white, 0x2f62a8, 0x3c3c3c, 0xd9d4c8, C.yellow, 0x6a8a3a, 0x8a2a2a];
    for (let k = 0; k < n; k++) { const p = -(n - 1) * gap / 2 + k * gap; if (r() < 0.18) minibus(B, x + Math.cos(ry) * p, z - Math.sin(ry) * p, ry); else car(B, x + Math.cos(ry) * p, z - Math.sin(ry) * p, ry, cs[Math.floor(r() * cs.length)]); }
  }
  function trafficLight(B, x, z, ry = 0) {
    const put = B.at(x, z, ry);
    put(cyl(0.005, 0.006, 0.2, 6), C.iron, 0, 0, 0); put(box(0.024, 0.06, 0.02), 0x2a2a2a, 0, 0.2, 0.01);
    put(box(0.014, 0.014, 0.004), 0xff3b2b, 0, 0.243, 0.021, { vary: 0 }); put(box(0.014, 0.014, 0.004), 0x5a3a1a, 0, 0.226, 0.021, { vary: 0 }); put(box(0.014, 0.014, 0.004), 0x1a3a1a, 0, 0.209, 0.021, { vary: 0 });
  }

  // ===== the corners: a model on Freedom Square (0) and on the embankment (20), the traffic jam (10) and the patrol at
  // Heroes Square (30) made here =====
  // (z: towards the square's outer edge)
  const CORNER_MODELS = {
    0: { url: 'art/m_tb_freedom.glb', fitWidth: 1.25, z: -0.22 },
    20: { url: 'art/m_tb_bench.glb', fitWidth: 1.05, z: -0.3, ry: 0 }
  };
  function corner(i) {
    const B = new Builder();
    if (i === 10) {
      jam(B, -0.08, -0.5, 7, 0, 0.13, 3); jam(B, -0.1, -0.32, 6, 0, 0.14, 7);
      trafficLight(B, 0.52, -0.46, 0); trafficLight(B, -0.58, -0.2, Math.PI);
      B.add(box(1.2, 0.002, 0.012), 0xf0ead8, 0, 0.001, -0.41);
    }
    if (i === 30) {
      // the memorial's arc of tall slabs, its eternal flame, the patrol car's lane
      for (let k = 0; k < 7; k++) { const a = Math.PI * (0.15 + 0.7 * k / 6); B.add(box(0.07, 0.24 + (k % 2) * 0.05, 0.03), 0x9a9286, Math.cos(a) * 0.4, 0, -0.62 + Math.sin(a) * 0.18, { ry: Math.PI / 2 - a }); }
      B.add(cyl(0.05, 0.06, 0.03, 10), 0x6a6458, 0, 0, -0.45);
      B.add(box(1.25, 0.002, 0.012), 0xf0ead8, 0, 0.001, -0.2);
      trafficLight(B, -0.6, -0.3, 0);
    }
    return B.parts.length ? B.build() : null;
  }

  // ===== what moves =====
  // on a corner: in its square's frame
  const FX = {
    0: { sparkle: [[0.0, -0.3, 0.75, 1]] },
    10: { sparkle: [[0.52, -0.42, 0.25, 1]] },
    30: { actors: [{ k: 'police', a: [-0.5, -0.12], b: [0.5, -0.12], speed: 0.12 }], sparkle: [[0.0, -0.45, 0.06, 1]] }
  };
  // in the city (board coordinates; heights above the model's top surface there): boats on the river, the baths' steam,
  // eagles round the tower (their heights the sky's own)
  const CENTER_FX = {
    smoke: [[CENTER.baths[0], CENTER.baths[1], 0.3], [CENTER.baths[0] + 0.16, CENTER.baths[1] - 0.1, 0.28], [CENTER.baths2[0], CENTER.baths2[1], 0.3]],
    mist: [], sheep: [],
    actors: [
      { k: 'boat', a: [-0.72, -2.3], b: [-0.2, -0.95], speed: 0.04, water: WATER_Y + 0.003 },
      { k: 'boat', a: [0.02, 1.7], b: [-0.07, 3.1], speed: 0.035, phase: 0.4, water: WATER_Y + 0.003 }      // (under the old bridge)
    ],
    birds: [{ at: TOWER, h: TOP + 0.4, r: 0.85, w: 0.3 }, { at: TOWER, h: TOP - 0.15, r: 1.45, w: -0.22 }]
  };

  // ===== the traffic on the embankments =====
  // Each road has a lane either way. The cars come in at a lane's start and go out at its end; each keeps its distance
  // from the one in front and brakes for it (as drivers do: the intelligent driver model), stops at a crossing's red
  // light (at its amber too, when it still can), and now and then one pulls up (a minibus taking someone on, a car
  // broken down) and the lane behind it jams; in busy spells more cars come. Once in a few minutes two cars crash:
  // smoke, a police car, a while later all drive on.
  const STEP = 0.02, CAR_S = 1.1, LAMP_Y = { R: 0.119, A: 0.106, G: 0.093 };
  let laneCache = null;
  // a lane: the road's middle line moved a lane to its right (the way back: turned round first), its points every STEP
  // along it and the way it faces there; the crossings' stop lines on it (how far along)
  function lanes() {
    if (laneCache || !ROADS) return laneCache;
    const L = [];
    for (const road of ['west', 'east']) for (const back of [false, true]) {
      const pts = back ? ROADS[road].slice().reverse() : ROADS[road], n = pts.length, off = [], d = ROADS.lane;
      for (let k = 0; k < n; k++) {
        const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]), fx = (b[0] - a[0]) / l, fz = (b[1] - a[1]) / l;
        off.push([pts[k][0] - fz * d, pts[k][1] + fx * d]);       // (to the right: x - fz, z + fx)
      }
      const cum = [0];
      for (let k = 1; k < n; k++) cum.push(cum[k - 1] + Math.hypot(off[k][0] - off[k - 1][0], off[k][1] - off[k - 1][1]));
      const m = Math.floor(cum[n - 1] / STEP) + 1, X = new Float32Array(m), Z = new Float32Array(m), A = new Float32Array(m);
      for (let i = 0, k = 0; i < m; i++) {
        const s = i * STEP;
        while (k < n - 2 && cum[k + 1] < s) k++;
        const t = (s - cum[k]) / (cum[k + 1] - cum[k]);
        X[i] = off[k][0] + (off[k + 1][0] - off[k][0]) * t; Z[i] = off[k][1] + (off[k + 1][1] - off[k][1]) * t;
      }
      for (let i = 0; i < m; i++) { const a = Math.max(0, i - 1), b = Math.min(m - 1, i + 1); A[i] = Math.atan2(-(Z[b] - Z[a]), X[b] - X[a]); }
      L.push({ road, back, X, Z, A, m, len: (m - 1) * STEP, stops: [] });
    }
    ROADS.crossings.forEach((c, ci) => {
      const pts = ROADS[c.road];
      let k = 0;
      for (let j = 1; j < pts.length; j++) if (Math.abs(pts[j][1] - c.z) < Math.abs(pts[k][1] - c.z)) k = j;
      for (const ln of L) if (ln.road === c.road) {
        let bi = 0, best = Infinity;
        for (let i = 0; i < ln.m; i++) { const d2 = (ln.X[i] - pts[k][0]) ** 2 + (ln.Z[i] - pts[k][1]) ** 2; if (d2 < best) { best = d2; bi = i; } }
        ln.stops.push({ ci, at: bi * STEP - 0.045 });
      }
    });
    for (const ln of L) ln.stops.sort((a, b) => a.at - b.at);
    return (laneCache = L);
  }
  // where a lane is at u along it (x, z, the way it faces); before its start and past its end, straight on
  function laneAt(ln, u, o) {
    const e = ln.m - 1, f = u / STEP;
    if (f <= 0 || f >= e) {
      const i = f <= 0 ? 0 : e, du = f <= 0 ? u : u - ln.len, a = ln.A[i];
      o.x = ln.X[i] + Math.cos(a) * du; o.z = ln.Z[i] - Math.sin(a) * du; o.a = a;
      return o;
    }
    const i = Math.floor(f), t = f - i, da = ln.A[i + 1] - ln.A[i];
    o.x = ln.X[i] + (ln.X[i + 1] - ln.X[i]) * t; o.z = ln.Z[i] + (ln.Z[i + 1] - ln.Z[i]) * t;
    o.a = ln.A[i] + Math.atan2(Math.sin(da), Math.cos(da)) * t;
    return o;
  }
  // a point in a lane's own frame at u: lx along its way, ly up from the road, lz to its right
  function laneFrame(ln, u, lx, ly, lz) {
    const q = laneAt(ln, u, {}), c = Math.cos(q.a), s = Math.sin(q.a);
    return { x: q.x + lx * c + lz * s, y: ROAD_Y + ly, z: q.z - lx * s + lz * c, a: q.a };
  }
  // the crossings' traffic lights: for each lane a pole on its right kerb just before its stop line, an arm out over
  // the lane, the head facing the cars that come (its lit lamp is one of the moving things)
  function lightPoles(B) {
    for (const ln of lanes() || []) for (const st of ln.stops) {
      const q = laneAt(ln, st.at - 0.012, {}), put = B.at(q.x, q.z, q.a, 1, ROAD_Y);
      put(cyl(0.0032, 0.0042, 0.136, 6), C.iron, 0, 0, 0.0415);
      put(box(0.004, 0.004, 0.038), C.iron, 0, 0.128, 0.0235);
      put(box(0.011, 0.042, 0.013), 0x2a2a2a, 0, 0.088, 0.008);
      for (const [k, c] of [['R', 0x4a1a14], ['A', 0x4a3a12], ['G', 0x123a1c]]) put(box(0.002, 0.008, 0.008), c, -0.0062, LAMP_Y[k] - 0.004, 0.008, { vary: 0 });
    }
  }

  // the cars: how often each comes (w), its length, how fast its driver likes to go (a: how fast it gets going, T: how
  // far behind the one in front it keeps, in seconds)
  const CARS = {
    car: { w: 15, len: 0.075, v: [0.12, 0.18] }, car2: { w: 13, len: 0.075, v: [0.12, 0.18] }, car3: { w: 16, len: 0.075, v: [0.12, 0.17] },
    car4: { w: 13, len: 0.078, v: [0.12, 0.17] }, car5: { w: 14, len: 0.075, v: [0.12, 0.18] }, taxi: { w: 9, len: 0.075, v: [0.16, 0.21] },
    minibus: { w: 12, len: 0.085, v: [0.13, 0.17] }, bus: { w: 5, len: 0.17, v: [0.09, 0.11], a: 0.09, T: 0.8 }, police: { w: 3, len: 0.077, v: [0.16, 0.19] }
  };
  const IDM = { a: 0.16, b: 0.32, s0: 0.016, T: 0.55 };
  // the traffic: its moving things (the cars, the lit lamps, a crash's smoke and the police car's lights), all run by
  // one clock (whichever of them is put in its place first in a frame moves them all on)
  function traffic({ lite = false } = {}) {
    const L = lanes();
    if (!L) return [];
    const r = rng(1 + Math.floor(Math.random() * 1e6)), rand = (a, b) => a + (b - a) * r(), MAX = lite ? 7 : 12, RATE = lite ? 0.13 : 0.2;
    const lights = ROADS.crossings.map(() => ({ s: 'G', until: rand(2, 14) }));
    const S = L.map(ln => ({ ln, cars: [], next: rand(0, 3), rush: 0, nextRush: rand(30, 120) }));
    const slots = {}, actors = [], Q = { x: 0, z: 0, a: 0 };
    let now = 0, last = null, nextStop = rand(10, 25), nextCrash = Infinity, crash = null, beacon = null, beaconOff = Infinity;
    const hide = o => { o.p.set(0, -1, 0); o.s = 0; };

    // a car in its place: it grows as it comes in at the lane's start and shrinks going out at its end; its nose dips
    // when it brakes hard; after a crash it stands askew
    function carActor(slot) {
      return { k: slot.k, up(t, o) {
        sync(t);
        const c = slot.car;
        if (!c) return hide(o);
        laneAt(c.ln, c.u, Q);
        o.p.set(Q.x, ROAD_Y, Q.z); o.yaw = Q.a + c.skew;
        o.s = CAR_S * c.fade * Math.max(0, Math.min(1, (c.u + c.len / 2) / 0.08, (c.ln.len - c.u + c.len / 2) / 0.08));
        o.pitch = c.acc < -0.25 ? Math.max(-0.045, c.acc * 0.03) : 0;
      } };
    }
    for (const k of Object.keys(CARS)) {
      const n = k === 'police' ? 3 : Math.ceil(MAX * 4 * CARS[k].w / 100 * 1.5) + 1;
      slots[k] = [];
      for (let j = 0; j < n; j++) { const slot = { k, car: null }; slots[k].push(slot); actors.push(carActor(slot)); }
    }
    // which kind comes next (of those with a place free; one police car is kept for a crash)
    function pick() {
      const ok = [];
      let sum = 0;
      for (const k in CARS) if (slots[k].filter(s => !s.car).length > (k === 'police' ? 1 : 0)) { ok.push(k); sum += CARS[k].w; }
      let x = r() * sum;
      for (const k of ok) if ((x -= CARS[k].w) <= 0) return k;
      return ok.length ? ok[ok.length - 1] : null;
    }
    function spawn(l) {
      if (l.cars.length >= MAX) return false;
      const tail = l.cars[l.cars.length - 1], room = tail ? tail.u - tail.len / 2 : Infinity;       // (its front comes in at 0)
      if (room < IDM.s0 + 0.05) return false;
      const k = pick();
      if (!k) return false;
      const c = CARS[k], len = c.len * CAR_S, v0 = rand(c.v[0], c.v[1]), slot = slots[k].find(s => !s.car);
      const car = { k, slot, ln: l.ln, len, u: -len / 2, v: tail ? Math.min(v0, tail.v + 0.03, Math.max(0, (room - IDM.s0) / 1.2)) : v0, v0,
        a: c.a || IDM.a, T: c.T || IDM.T, acc: 0, skew: 0, fade: 1, held: false, blind: false, brake: false, stopAt: null };
      slot.car = car; l.cars.push(car);
      return true;
    }
    // no stop line within `d` ahead of a car's front
    const clearAhead = (l, c, d) => !l.ln.stops.some(st => st.at > c.u + c.len / 2 - 0.05 && st.at < c.u + c.len / 2 + d);
    function move(l, dt) {
      const cs = l.cars;
      for (let i = 0; i < cs.length; i++) {
        const c = cs[i];
        if (c.held) { c.v = 0; c.acc = 0; continue; }
        const front = c.u + c.len / 2;
        let gap = Infinity, dv = 0;
        if (i > 0 && !c.blind) { const p = cs[i - 1]; gap = p.u - p.len / 2 - front; dv = c.v - p.v; }
        // the light ahead: red, it stops (unless it is too close to); amber, it stops if it still can do so gently
        for (const st of l.ln.stops) {
          const d = st.at - 0.008 - front;
          if (d < -0.01) continue;
          const s = lights[st.ci].s;
          if (s !== 'G' && d < gap && d >= c.v * c.v / (2 * (s === 'A' ? IDM.b * 1.2 : 1.2))) { gap = d; dv = c.v; }
          break;
        }
        if (c.stopAt != null && c.stopAt - front < gap) { gap = c.stopAt - front; dv = c.v; }
        const want = IDM.s0 + Math.max(0, c.v * c.T + c.v * dv / (2 * Math.sqrt(c.a * IDM.b)));
        c.acc = c.brake ? -1.4 : c.a * (1 - (c.v / c.v0) ** 4 - (gap === Infinity ? 0 : (want / Math.max(gap, 1e-3)) ** 2));
        c.acc = Math.max(-2.5, Math.min(c.a, c.acc));
      }
      for (const c of cs) if (!c.held) { c.v = Math.max(0, c.v + c.acc * dt); c.u += c.v * dt; }
      // (never into the one in front)
      for (let i = 1; i < cs.length; i++) { const p = cs[i - 1], c = cs[i], lim = p.u - (p.len + c.len) / 2 - 0.003; if (c.u > lim) { c.u = lim; c.v = Math.min(c.v, p.v); } }
      while (cs.length && cs[0].u - cs[0].len / 2 > l.ln.len) { cs[0].slot.car = null; cs.shift(); }
    }
    // now and then a car pulls up a little ahead and stands a while: a minibus taking someone on (most often), or a car
    // broken down
    function pullUp() {
      const cands = [];
      for (const l of S) for (const c of l.cars) if (!c.held && !c.blind && c.stopAt == null && c.k !== 'police' && c.v > 0.05 && c.u > 0.4 && c.u < l.ln.len - 0.8 && clearAhead(l, c, 0.45)) cands.push(c);
      if (!cands.length) return false;
      const minis = cands.filter(c => c.k === 'minibus'), c = minis.length && r() < 0.6 ? minis[Math.floor(r() * minis.length)] : cands[Math.floor(r() * cands.length)];
      c.stopAt = c.u + c.len / 2 + c.v * c.v / (2 * 0.2) + 0.03; c.stopFor = c.k === 'minibus' ? rand(4, 7) : rand(8, 14); c.stopSet = now; c.stoppedAt = null;
      return true;
    }
    // a crash: the one in front brakes hard all of a sudden, the one behind does not see it in time
    function tryCrash() {
      for (const l of S.slice().sort(() => r() - 0.5)) {
        const cs = l.cars;
        for (let i = 1; i < cs.length; i++) {
          const B = cs[i - 1], A = cs[i], gap = B.u - B.len / 2 - (A.u + A.len / 2);
          if ([A, B].some(c => c.held || c.blind || c.stopAt != null || c.k === 'bus' || c.k === 'police' || c.v < 0.08)) continue;
          if (gap < 0.04 || gap > 0.22 || B.u < 0.6 || B.u > l.ln.len - 1.2 || !clearAhead(l, A, 0.9)) continue;
          B.brake = true; A.blind = true;
          crash = { l, A, B, at: now, hit: null, end: null, police: null };
          return true;
        }
      }
      return false;
    }
    function stepCrash(dt) {
      const { l, A, B } = crash;
      if (!crash.hit) {                                      // (braking, about to bump)
        if (B.v <= 0) { B.brake = false; B.held = true; }
        if (A.u + A.len / 2 >= B.u - B.len / 2 - 0.004 || now - crash.at > 6) {
          A.u = Math.min(A.u, B.u - (B.len + A.len) / 2 - 0.002);
          A.v = B.v = 0; A.blind = B.brake = false; A.held = B.held = true;
          crash.hit = now; crash.end = now + rand(15, 20);
          crash.sA = (r() < 0.5 ? 1 : -1) * rand(0.25, 0.42); crash.sB = -Math.sign(crash.sA) * rand(0.05, 0.12);
        }
        return;
      }
      if (now < crash.end) {
        const k = Math.min(1, (now - crash.hit) / 0.35);       // (they swing askew)
        A.skew = crash.sA * k; B.skew = crash.sB * k;
        // a while after, the police: pulled up just in front of them, its lights flashing (when there is room)
        if (!crash.police && now - crash.hit > 2.5 && now < crash.end - 5) {
          const slot = slots.police.find(s => !s.car), len = CARS.police.len * CAR_S, at = B.u + (B.len + len) / 2 + 0.025, i = l.cars.indexOf(B), ahead = l.cars[i - 1];
          if (slot && i >= 0 && (!ahead || ahead.u - ahead.len / 2 > at + len / 2 + 0.02)) {
            const P = { k: 'police', slot, ln: l.ln, len, u: at, v: 0, v0: rand(0.16, 0.19), a: IDM.a, T: IDM.T, acc: 0, skew: 0, fade: 0, held: true, blind: false, brake: false, stopAt: null };
            slot.car = P; l.cars.splice(i, 0, P); crash.police = beacon = P;
          }
        }
        if (crash.police) crash.police.fade = Math.min(1, crash.police.fade + dt);
        return;
      }
      // all drive on: the police first, then the one in front; the other once it has turned straight again
      const e = now - crash.end;
      if (crash.police) crash.police.held = false;
      B.held = false; B.skew = crash.sB * Math.max(0, 1 - e);
      A.skew = crash.sA * Math.max(0, 1 - e / 1.5);
      if (e >= 1.5) { A.held = false; A.skew = B.skew = 0; crash = null; nextCrash = now + rand(200, 420); beaconOff = now + 2.5; }
    }
    function step(dt) {
      now += dt;
      for (const g of lights) if (now >= g.until) {
        if (g.s === 'G') { g.s = 'A'; g.until = now + 2; } else if (g.s === 'A') { g.s = 'R'; g.until = now + rand(6, 9); } else { g.s = 'G'; g.until = now + rand(9, 18); }
      }
      for (const l of S) if (now >= l.next) {
        if (now >= l.nextRush) { l.rush = now + rand(20, 45); l.nextRush = l.rush + rand(60, 150); }
        l.next = now + (spawn(l) ? Math.max(0.8, -Math.log(1 - r()) / (RATE * (now < l.rush ? 2.3 : 1))) : 0.35);
      }
      for (const l of S) for (const c of l.cars) if (c.stopAt != null) {
        if (c.stoppedAt == null && c.v < 0.004 && c.u + c.len / 2 >= c.stopAt - IDM.s0 - 0.012) c.stoppedAt = now;
        if ((c.stoppedAt != null && now - c.stoppedAt > c.stopFor) || now - c.stopSet > 40) c.stopAt = null;
      }
      if (now >= nextStop) nextStop = now + (pullUp() ? rand(18, 45) : 4);
      if (!crash && now >= nextCrash) nextCrash = tryCrash() ? Infinity : now + 6;
      if (crash) stepCrash(dt);
      if (beacon && (beacon.slot.car !== beacon || now > beaconOff)) { beacon = null; beaconOff = Infinity; }      // (its lights off once it drives on)
      for (const l of S) move(l, dt);
    }
    // the clock: the board's time, a quarter of a second at most a frame (after a pause, a hidden page, the traffic goes
    // on from where it was; on a very slow screen it goes slower)
    function sync(t) {
      if (t === last) return;
      const dt = last == null ? 0 : t - last;
      last = t;
      if (!(dt > 0)) return;
      for (let h = Math.min(dt, 0.25); h > 1e-6; h -= 0.05) step(Math.min(0.05, h));
    }

    // the lit lamps: one of each colour on each pole, shown when its light is that
    for (const l of S) for (const st of l.ln.stops) for (const [k, s] of [['lampR', 'R'], ['lampY', 'A'], ['lampG', 'G']]) {
      const f = laneFrame(l.ln, st.at - 0.012, -0.0068, LAMP_Y[s] - 0.0045, 0.008), p = new T.Vector3(f.x, f.y, f.z), g = lights[st.ci];
      actors.push({ k, up(t, o) { sync(t); o.p.copy(p); o.yaw = f.a; o.s = g.s === s ? 1 : 0; } });
    }
    // a crash's smoke: puffs rising off the bump, one after another, for a few seconds
    for (let j = 0; j < 3; j++) actors.push({ k: 'puff', up(t, o) {
      sync(t);
      const age = crash && crash.hit != null && now < crash.end ? now - crash.hit : -1, f = age - j * 0.7;
      if (age < 0 || age > 10 || f < 0) return hide(o);
      const q = (f / 2.1) % 1, A = crash.A;
      laneAt(A.ln, A.u + A.len / 2, Q);
      o.p.set(Q.x + 0.012 * Math.sin(j * 2.1 + q * 3), ROAD_Y + 0.03 + 0.17 * q, Q.z + 0.012 * Math.cos(j * 1.7 + q * 2));
      o.yaw = j * 2.1 + q; o.s = (0.4 + 0.9 * q) * Math.min(1, (1 - q) / 0.35) * Math.min(1, (10 - age) / 2);
    } });
    // the police car's lights, blue and red by turns, while it stands at a crash (and a little after)
    for (const [k, lz, ph] of [['flashB', -0.009, 0], ['flashR', 0.01, 0.5]]) actors.push({ k, up(t, o) {
      sync(t);
      const P = beacon;
      if (!P || ((now * 2.4 + ph) % 1) > 0.5) return hide(o);
      laneAt(P.ln, P.u, Q);
      const c = Math.cos(Q.a), s = Math.sin(Q.a);
      o.p.set(Q.x + lz * CAR_S * s, ROAD_Y + 0.05 * CAR_S, Q.z + lz * CAR_S * c); o.yaw = Q.a; o.s = CAR_S * P.fade;
    } });

    // (the traffic is already going when the board is first seen; the first crash comes after a minute or two)
    for (let k = 0; k < 700; k++) step(0.1);
    nextCrash = now + rand(50, 140);
    // (for looking into it: its state; a crash as soon as one can happen)
    actors.state = () => ({ now, lanes: S, lights, crash });
    actors.crashSoon = () => { if (!crash) nextCrash = now; };
    actors.where = c => laneAt(c.ln, c.u, {});
    traffic.last = actors;
    return actors;
  }

  // ----- the moving things' own shapes (around their own origin, facing +x) -----
  const CAR_LOOK = { car: [C.red, 0], car2: [0x2f62a8, 0], car3: [C.white, 1], car4: [0x3c3f44, 2], car5: [0xb9bec6, 0], taxi: [C.yellow, 3], police: [C.white, 0] };
  const LAMP = { lampR: 0xff3322, lampY: 0xffb21e, lampG: 0x2dff6a };
  function actor(k) {
    const B = new Builder();
    if (CAR_LOOK[k]) {
      car(B, 0, 0, 0, CAR_LOOK[k][0], 1, CAR_LOOK[k][1]);
      if (k === 'police') { B.add(box(0.012, 0.008, 0.026), 0x2a5ad8, 0, 0.048, -0.007); B.add(box(0.012, 0.008, 0.012), 0xe8342a, 0, 0.048, 0.01); B.add(box(0.077, 0.006, 0.037), 0x2a5ad8, 0, 0.016, 0); }
    } else if (k === 'bus') bus(B, 0, 0, 0, 0x3f7fc2);
    else if (k === 'minibus') minibus(B, 0, 0, 0);
    else if (LAMP[k]) B.add(box(0.009, 0.009, 0.009), LAMP[k], 0, 0, 0, { vary: 0 });
    else if (k === 'flashB' || k === 'flashR') B.add(box(0.012, 0.009, 0.012), k === 'flashB' ? 0x3a7bff : 0xff3030, 0, 0, 0, { vary: 0 });
    else if (k === 'puff') {
      B.add(ball(0.016, 1), 0xb9b6ae, 0, 0.016, 0, { round: true }); B.add(ball(0.012, 1), 0xa3a098, 0.013, 0.011, 0.006, { round: true });
      B.add(ball(0.011, 1), 0xcac7bf, -0.011, 0.022, -0.005, { round: true });
    } else return Models.actor(k);
    return B.build();
  }

  // ===== what the players build, painted in their colour: a house (1 to 4 on a square) or a hotel =====
  function houseParts() {
    const B = new Builder(), R = new Builder();
    B.add(box(0.14, 0.14, 0.12), C.cream, 0, 0, 0);
    B.add(box(0.13, 0.05, 0.03), C.balcony, 0, 0.075, 0.065);
    B.add(box(0.13, 0.012, 0.04), C.wood2, 0, 0.07, 0.065);
    for (const x of [-0.035, 0.035]) B.add(pane(0.03, 0.04), C.win, x, 0.025, 0.061, { vary: 0 });
    B.add(pane(0.03, 0.05), C.wood2, 0, 0, 0.0615, { vary: 0 });
    R.add(pyr(0.17, 0.09, 0.15), 0xffffff, 0, 0.14, 0, { vary: 0 });
    R.add(box(0.018, 0.04, 0.018), 0xffffff, 0.04, 0.17, -0.02, { vary: 0 });
    return { body: B.build(), roof: R.build() };
  }
  function hotelParts() {
    const B = new Builder(), R = new Builder();
    B.add(box(0.36, 0.34, 0.16), C.panel3, 0, 0, 0);
    for (let f = 0; f < 6; f++) B.add(pane(0.32, 0.026), C.glass, 0, 0.03 + f * 0.05, 0.081, { vary: 0 });
    B.add(box(0.12, 0.05, 0.04), C.glass2, 0, 0, 0.09);
    R.add(box(0.38, 0.024, 0.18), 0xffffff, 0, 0.34, 0, { vary: 0 });
    R.add(box(0.22, 0.06, 0.012), 0xffffff, 0, 0.364, 0.02, { vary: 0 });         // its sign on the roof
    R.add(box(0.04, 0.34, 0.165), 0xffffff, 0.16, 0, 0, { vary: 0 });              // a band down its side
    return { body: B.build(), roof: R.build() };
  }

  // ===== public =====
  // (the model is the whole inside: no land is shaped and nothing is made for the districts or the middle; the land
  // lies flat under the model, and the heights things stand at are the model's)
  const nothing = () => { };
  function centerRelief(R) { if (HEIGHTS && R.useHeights) R.useHeights(HEIGHTS); }
  function inner() { return new Builder().build(); }
  function center() { const B = new Builder(); lightPoles(B); return { B, steps: [] }; }
  let houseCache = null, hotelCache = null;
  return {
    world: 'city', PAL, relief: nothing, lot: () => null, corner, ringRelief: nothing, inner, centerRelief, centerWater: () => null, center, CENTER, CENTER_FX, actor, traffic,
    models: {}, cornerModels: CORNER_MODELS, freeModels: [], boardModel: BOARD_MODEL, clouds: 2, waterY: WATER_Y,
    fx: i => FX[i] || null,
    tower: () => houseCache || (houseCache = houseParts()),
    castle: () => hotelCache || (hotelCache = hotelParts()),
    LIFE: ['car', 'car2', 'car3', 'car4', 'car5', 'taxi', 'police', 'bus', 'minibus', 'lampR', 'lampY', 'lampG', 'flashB', 'flashR', 'puff', 'boat', 'sail', 'eagle', 'wing'],
    GLOW: ['lampR', 'lampY', 'lampG', 'flashB', 'flashR'],               // (lit: drawn in their own colours, whatever the light)
    BIRD: ['eagle', 'wing']
  };
})();
