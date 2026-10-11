// Content revisions retain unchanged models across code updates. Cached assets
// are returned without background re-downloads; gameplay and offline preparation
// share one bounded queue. tools/build.py fills the version and revision manifest.
const VERSION = "464b77f3f5";
const ARTS = ["por_h_david.webp", "por_h_tamar.webp", "por_h_gorgasali.webp", "por_h_erekle.webp", "por_h_kakutsa.webp", "por_h_tariel.webp", "por_h_avtandil.webp", "por_h_gurdjieff.webp", "por_h_abrag.webp", "por_h_amirani.webp", "por_h_mikha.webp", "por_h_prometheus.webp", "h_tamar.webp", "h_gorgasali.webp", "h_erekle.webp", "h_kakutsa.webp", "h_tariel.webp", "h_avtandil.webp", "h_gurdjieff.webp", "h_abrag.webp", "h_amirani.webp", "h_mikha.webp", "h_prometheus.webp", "h_davidride.webp", "por_p_blackbeard.webp", "por_p_bonny.webp", "por_p_read.webp", "por_p_chingshih.webp", "por_p_omalley.webp", "por_p_morgan.webp", "por_p_kidd.webp", "por_p_roberts.webp", "por_p_barbarossa.webp", "por_p_bellamy.webp", "por_p_labuse.webp", "por_p_stortebeker.webp", "bg_sea.webp", "sc_north.webp", "sc_gotland.webp", "sc_med.webp", "sc_atlantic.webp", "sc_antilles.webp", "sc_caribbean.webp", "sc_indian.webp", "sc_pacific.webp", "sc_oak.webp", "sc_cocos.webp", "sc_qar.webp", "sc_whydah.webp", "sc_galley.webp", "sc_fortune.webp", "sc_lighthouse.webp", "sc_shipyard.webp", "sc_customs.webp", "sc_whirlpool.webp", "sc_port.webp", "sc_isle.webp", "sc_tavern.webp", "sc_kraken.webp", "sc_chest.webp", "sc_bottle.webp", "t_archer_2.webp", "s_fort.webp", "s_camp.webp", "t_palisade.webp", "ui_page.webp", "ui_chest_wood.webp", "ui_chest_wood_o.webp", "ui_coin.webp", "ui_coinbag.webp", "ui_book.webp", "ui_feather.webp", "g_svan.webp", "g_elbrus.webp", "g_pass.webp", "g_stone.webp", "g_tbilisi.webp", "card_00_corner_port.jpg", "card_03_gotland_visby.jpg", "card_04_customs_house.jpg", "card_05_ship_queen_annes_revenge.jpg", "card_09_gramvousa_fort.jpg", "card_10_corner_castaway.jpg", "card_12_lighthouse.jpg", "card_15_ship_whydah.jpg", "card_18_tortuga.jpg", "card_20_corner_tavern.jpg", "card_25_ship_adventure_galley.jpg", "card_28_shipyard.jpg", "card_30_corner_kraken.jpg", "card_31_cheung_chau.jpg", "card_35_ship_royal_fortune.jpg", "card_37_oak_island.jpg", "card_38_whirlpool.jpg", "m_heligoland_animated.glb", "m_cocos_animated.glb", "m_volcano_animated.glb", "m_gotland_animated.glb", "m_customs_animated.glb", "m_gramvousa_animated.glb", "m_lighthouse_animated.glb", "m_shipyard_animated.glb", "m_cheungchau_animated.glb", "m_oak_animated.glb", "m_port_animated.glb", "m_castaway_animated.glb", "m_tavern_animated.glb", "m_kraken_animated.glb", "m_qar_animated.glb", "m_whydah_animated.glb", "m_galley_animated.glb", "m_fortune_animated.glb", "m_shark.glb", "m_orca.glb", "m_bluewhale.glb", "m_dolphin.glb", "mobile/m_heligoland_animated.glb", "mobile/m_cocos_animated.glb", "mobile/m_volcano_animated.glb", "mobile/m_gotland_animated.glb", "mobile/m_customs_animated.glb", "mobile/m_gramvousa_animated.glb", "mobile/m_lighthouse_animated.glb", "mobile/m_shipyard_animated.glb", "mobile/m_cheungchau_animated.glb", "mobile/m_oak_animated.glb", "mobile/m_port_animated.glb", "mobile/m_castaway_animated.glb", "mobile/m_tavern_animated.glb", "mobile/m_kraken_animated.glb", "mobile/m_qar_animated.glb", "mobile/m_whydah_animated.glb", "mobile/m_galley_animated.glb", "mobile/m_fortune_animated.glb"];
const ASSET_REVISIONS = {"art/bg_sea.webp": "fe50993d2a01571d6fa39013e26c034afe2b17201e12a1af92013177977de5b4", "art/card_00_corner_port.jpg": "8639155e032ea535a5dba7370c93326966941fd37583e6d0c944c34b01109d88", "art/card_03_gotland_visby.jpg": "88a87a48f0e1dc9e3dbdbffad8296e453baadc4d9a19f9c9b064d78edf2d2cda", "art/card_04_customs_house.jpg": "ee1bc20e0db0c3ff71c4274e38039aa63552c83a82a9429703d636e455fcd657", "art/card_05_ship_queen_annes_revenge.jpg": "cc0a7eb5b9646ba570bc7713ea58cf042fdd2bacfae017e8493ba78b49be6bb9", "art/card_09_gramvousa_fort.jpg": "1b9bc19ed5009dc22d560b9a2fee85205c497fd569062b7a902d18badc452415", "art/card_10_corner_castaway.jpg": "2b0dfc1b426ce3539599b5240132f572a9bd2a93b7fd875c4404be0cdb0fb1c9", "art/card_12_lighthouse.jpg": "a9b6852097fa128ebb91f0f9107238be704fd28b0a86c7a4305b1e38e498074d", "art/card_15_ship_whydah.jpg": "dd2b02f20c6b93e8fda7a50ebb6173d8f4c1653a3dc5e66d8db5e824d82e5e8f", "art/card_18_tortuga.jpg": "97d79320c5d4588bbc364aa83d3c3ee7edf4a3d249c9a3cefbd0e97041ab031a", "art/card_20_corner_tavern.jpg": "bee31e68808b887e866df877156d99bdb317566cf53f80f904186cf3943d6a10", "art/card_25_ship_adventure_galley.jpg": "68085257ea6933a86cc5e6d2f3c0c8b14508ee5d1c069419aa78249637dea2d5", "art/card_28_shipyard.jpg": "a9395dcda8832e322cff59ca45b174e997f5f7456989424b002081e8d958aa61", "art/card_30_corner_kraken.jpg": "b7125307b4d691788221d7bae658bace17117b3323a04ef336f891936ceece65", "art/card_31_cheung_chau.jpg": "610ad1ef840c3333d49c6ebb3cdf02cb22a542082a9f99f9b2a33b3f08c16334", "art/card_35_ship_royal_fortune.jpg": "f44f7b7bc6cbc31bd3da29853f308ef7cb03b19265de1d5aef80d5fe8bc61d85", "art/card_37_oak_island.jpg": "25cf1bcf5ed5739c5fc0293eae9b67ec0bfd54c949ab4b11f934d0fc493aba57", "art/card_38_whirlpool.jpg": "387460790babe8b13eca0be5222e8e4e52a7d2cdc4e25c375f776cf0d87578b7", "art/g_elbrus.webp": "ec373f44231949361852731979cc2b0d0ea0c09beff08c714155b8ae1a055397", "art/g_pass.webp": "ab90f9c0bb2759f84119f5136057c4c26f3bb658121a8d2712aad53af2350d12", "art/g_stone.webp": "c60a657ceeaba06d6126b3d8fe9b34f1bf3febfd2a610d1ca96077a180cd5c5e", "art/g_svan.webp": "ab8e480d229a5b1cd802594c8c3db3c54536453d2267183cda3c3b616aaa7928", "art/g_tbilisi.webp": "ceacbaea3d6e39cf57f711cfbdbd26c6361fbe9d5f659eb03234de215071b190", "art/h_abrag.webp": "3bcdd5909257d0ccb59b48fda1cc8ee0578608fe61e8de0b816dca2230d0b23d", "art/h_amirani.webp": "5668c4a162b919f66d43bddfd11f23200dc4de78c98e1bdccaa42874a2d0a817", "art/h_avtandil.webp": "b106792899ecb5e9e6ed0409cfad1194a8ee4c9ed977f7dda8255d77e9e096b8", "art/h_davidride.webp": "36e5dd6acb2e1e293942dce55245a31c135cfc8c683a90bd6466dfb586047785", "art/h_erekle.webp": "a291f0f5a6eaa27993d669e60b57d6eb7f9185483c98f9a8e3054b6b5cab973f", "art/h_gorgasali.webp": "dbfdff38cb26a96db39eb7c25df2fec5dd93b9d7892acd1b474b82c2e568aa3e", "art/h_gurdjieff.webp": "108606edfe969fb218d3ba67c33b98a7d0c391645aca95d633ac6f6d12f0a34d", "art/h_kakutsa.webp": "1b32c119a7193be339385851b87ae2464e9158c4363a9a6cd2fe7df88eb70213", "art/h_mikha.webp": "d4b4dcff73424a90bb78bf9805c29005ff850a069870b1834999ee707ec2b93d", "art/h_prometheus.webp": "d82b5a31d606e36ebbf84d21190f08d674e596bb41e137fa849777b0f361257c", "art/h_tamar.webp": "bc5b43ff55d95ff97252ac3bfe83d5b41d5d85fd258c32d03b5726a75f52e6f0", "art/h_tariel.webp": "3ca48ef418aaf8e6005e8e8ef816a48ec86880e1ae43c04aa4f4c8245727b19f", "art/m_bluewhale.glb": "95540961b46b76e38b5447fdd88de4d3300801625faee17d5ac3eb94a1b5b7df", "art/m_castaway_animated.glb": "688c9824757e44bdc2b86b2ea8fb6751e3bf338e99e0a52fb5ca2d5e815c2a0b", "art/m_cheungchau_animated.glb": "3f613b8c1e3c6ab41127d2b2b5894123cd9d262aa2526613d865a4cb92db0105", "art/m_cocos_animated.glb": "f60ee36e77135a05e0ec9276c42a1cc8101d9e47b49867f0dd7c1981e55e7b25", "art/m_customs_animated.glb": "b6599cbed978f29c94a591a3f06f02fcf4fa50b9eb9986b96db65d4958a95519", "art/m_dolphin.glb": "1b831c3e84c5a3e70174d937cc1053deb280cb756e8906dca7fe42792560fefe", "art/m_fortune_animated.glb": "1b51898f3599bf787e4e481ca40e7144cc773af59b5749fd1c5fd9633004de00", "art/m_galley_animated.glb": "6abbe9f758cb314918e70529cde68e8dc123f1ca47e3b2a13d93ae44cda1ee37", "art/m_gotland_animated.glb": "530f6bc20c3d93d9ea23497aa3f42b12d9726dea3c7509e789e0160975aa5760", "art/m_gramvousa_animated.glb": "fe1ef609ceb29731bb32ae37c05ab1aba561e1166a42f1e235655798b328a5a6", "art/m_heligoland_animated.glb": "2cb0aba0fe049bf55ea0bfb124e6eeceaf185067f7b8ba3efda87872140dffeb", "art/m_kraken_animated.glb": "1bec5068f0bbf49f1a42c3584518ba7cad0fc32b5ca0ab02d3228086baf19291", "art/m_lighthouse_animated.glb": "c5fdcf089f2b8ede7cae838f494de869a503ca4d04311706825b6d8931aed079", "art/m_oak_animated.glb": "3d16b6bfedb32d322f41adb2b9f2c9bda95629217e4ac5a3e5db068d4c6bcf16", "art/m_orca.glb": "7ca2baf90c8c9b3578f1a7c78127b8d1650bda0ff97617cab9df15cb52a6e2b6", "art/m_port_animated.glb": "859bd894cac6f615d5c6aee07683a4b6027783d8aa8e4ff38e24f9aa4ff78faf", "art/m_qar_animated.glb": "ff6e1152f905b0e466a6749aa1f8e82948bf3436ac6b8b2d608a93e9965e6ac3", "art/m_shark.glb": "37a08c2e93ffe2c6d3a9d3a79692f8a99fb179b31e15e1e90cc8d641535c2e37", "art/m_shipyard_animated.glb": "bed6501c8e64d2ba877b1a21f7d100c98210993a97202063cc1640371c3a0d13", "art/m_tavern_animated.glb": "35fe27d1f51362ecd1983ebb04e5ee476ab8ac187bba1d3f6def28b6162a8c2e", "art/m_volcano_animated.glb": "e5fac10bcf0b7d44650d6c5f1bf977a400e70387dad5cc48dcbb5ab0b5f65fd2", "art/m_whydah_animated.glb": "0f2e69304fbcf51751d255cd338c0d0ad6b7ccfcc514cfe95e46fb3b2d3236ea", "art/mobile/m_castaway_animated.glb": "b44a0576051798fd4b9161477b1faf672eeb20b70e4ae875400454113c0a1b2f", "art/mobile/m_cheungchau_animated.glb": "f5337383ea10cce9e1d0f25cc86c7663530327549252ed73a787d01bd1c173cb", "art/mobile/m_cocos_animated.glb": "d4404aa1b21468dcd38ef255004bfb9e973c519c5dd46ab961d05b137afa075d", "art/mobile/m_customs_animated.glb": "51aa4ab1ea557bae949608dde2b49db501f51f21a4367e5d36ab5a8b73ad73d1", "art/mobile/m_fortune_animated.glb": "eac592ec8700fc3acba53990e194cb6f6e98dc58e3d8b8540e577d0c60d6a4a9", "art/mobile/m_galley_animated.glb": "e9632f0a3863516c58b1a5726f24abdf9840d5910b7bded915b1467feef69668", "art/mobile/m_gotland_animated.glb": "bd4a80eb4d6cd47096555bfe9198fc46ead44a2c8bc4676ab84d670398b57208", "art/mobile/m_gramvousa_animated.glb": "e6eacec75613fda312fe14aabf62933ab8207f512c50efbe9b0d3c9388096a0e", "art/mobile/m_heligoland_animated.glb": "e85a659688ea1620d684289b2ea5afdd5538cd3edfc75e68c297f5a11f3904fc", "art/mobile/m_kraken_animated.glb": "364b08f2de91513fadbc975367b61d05de523aa2f0857f06fd7429678017ede2", "art/mobile/m_lighthouse_animated.glb": "c40190fd84ae8fb772981618b8d6de7539a946fa6678b51d8b4fc3e4a679ae2f", "art/mobile/m_oak_animated.glb": "62c58492a5d93121a05b5adeff29f39551146f779de3cfbf87170861b8380eca", "art/mobile/m_port_animated.glb": "86486e460eda60c46e6892ca5dd0a6286d967587f8566ab645a6dbfb23e6418f", "art/mobile/m_qar_animated.glb": "52ccaaa407eb429c54df752886c97abf4c9eac123e9809b81189c077365ffb54", "art/mobile/m_shipyard_animated.glb": "b8a76a6df34052796c7be5d9b6cb31b213f1233c0503b6525289718b4a915353", "art/mobile/m_tavern_animated.glb": "7dc182bcceed74d960d6443fa507044049cc2c66f636984391cc07642a3e9767", "art/mobile/m_volcano_animated.glb": "450cbd66634ca7f948094a9a00dbdb399a2b72cb9b3830cf6b89043278f9ba43", "art/mobile/m_whydah_animated.glb": "66421f5e52090488986d771a895c9b3b7866d3e3970ed84a4f316e3628c5269c", "art/por_h_abrag.webp": "b399e2f99a064c46a0ddfee8cd9b9082dec9ec2dbd4b808ec5e3951f2148b11e", "art/por_h_amirani.webp": "001a634a4e132b11e42d387331322193ee60e3c7c78156295da4a3b52198a9cf", "art/por_h_avtandil.webp": "5765e9185f8e6e1cca8c864fa17fe36c1db75dac4909b886cf29c8308f70f9c1", "art/por_h_david.webp": "d791dcf1f6f168cc1c227a6cc632ccdc62d0aa7f9e900f0828d1e38a0145efdc", "art/por_h_erekle.webp": "03cd82286836ecac32fc3ae56c45e14ebff2cf3daf675fc265353185c9c029c6", "art/por_h_gorgasali.webp": "d013bcd0738f3c8958619215815457502de0f2bd29fff73383cd364a8f226fdd", "art/por_h_gurdjieff.webp": "d1ad3067de422f47d58163a54c8438bc62cb96faa3110a81b4a7477deda8d376", "art/por_h_kakutsa.webp": "73a9060958c9d1b33f4b69ed7bb3031de4e898847b7d3b970e89be26a9cc5c7b", "art/por_h_mikha.webp": "0d7e742976628f7a3dccf8568ecd7e6b4bfa8aa2aac2d6b3067e30f082411f9e", "art/por_h_prometheus.webp": "8ea4783547ed84804cdb2044a9241783c2ea3566fad32125d97a54f61cf8106e", "art/por_h_tamar.webp": "bc9ce386ea60a21493b7b647c8fc4feec641d167bfb1323dee49bf73af0a7b11", "art/por_h_tariel.webp": "75d0593500aa8410abeb82085d1352b9daee3cb841f141c5fe63d7919b47569f", "art/por_p_barbarossa.webp": "2bf85e06da66bdb788282024f6a1bb5fce4594c3b16114b3d13e1153082cdf02", "art/por_p_bellamy.webp": "91442f76fe25ac1d844db247a5c7f266671bd0933506b7ddeb13736609073e3b", "art/por_p_blackbeard.webp": "fabac783d368b408b802a7663a63cf8edd92f3b7f66ce3c8a4ba9b35531f42f9", "art/por_p_bonny.webp": "15f4103f9ce7d349555ca128b8e22df5bf8234d0549f5821a155c020d7366395", "art/por_p_chingshih.webp": "13dcd6273cee143bb884f6cfcaf86f0d8cdb7a6f2abe36543646d859c16d47dd", "art/por_p_kidd.webp": "442151dfa684d3b545adc3fd215dfacf0a4c0fb10c9659754eb068fce63a8a5c", "art/por_p_labuse.webp": "d88bd0b0c92dfe6a94b05ff01eb31e09afa975818b3d0dc7eb6e19f56d057bda", "art/por_p_morgan.webp": "65a0d53410cdd1df09f46d8035c7cd98740e9c82fc3eb6f198aa288b1feaf9ec", "art/por_p_omalley.webp": "8e8ff0cf0321c4881f7e8a3ecb451068edce926f463006ffca7bbf23fe26ffd3", "art/por_p_read.webp": "89187b97878d8df124633e7404f50c761b4f1e215ac44485ce7eeb0efe69df56", "art/por_p_roberts.webp": "6e3d7f4419e10bdbee031bd79ed2e72c03f114232a97079a24af1d9b31841060", "art/por_p_stortebeker.webp": "1187863b3d8f7188ce99ce39388d243c3a1f4dcab0155cd71c633970efc0a2db", "art/s_camp.webp": "92dfef22593afc1c1869b3224eedaf4491ed8334608e39cb48e2521794eb4b34", "art/s_fort.webp": "52f6058bfa826dee343ed145c49b97360e324013bc641e89711b3d740ee08816", "art/sc_antilles.webp": "5aaaf4d75e1f1d515130ab9b1290b0ad5ab7eab31aca4313b741a9660b0a1bc2", "art/sc_atlantic.webp": "71c6f7a17f3009047a3d7bf79e61840a012c5ef213156ea5cc8aec152ec597ad", "art/sc_bottle.webp": "c79c6985a42a3d87a804d01fd7b6f78d961f5f5526b111c234e9bb84f9a8b9cc", "art/sc_caribbean.webp": "5c1d8c51d299fb467701a9e3ab9761899904a4446c84161d9ca03fb5fdbd6c24", "art/sc_chest.webp": "5ed5990fa77fa83c75a86b1019b29ef51ed24eaea528402db11279cbf1479884", "art/sc_cocos.webp": "6dabc6e7b4f1bb5b3364ef1ade0012d3f60c1287d319d203508b82cbfcab9295", "art/sc_customs.webp": "44c6e0367847dc95d6c65642e9655a7d9daf630186bb8ebf84f2aa618ba4d637", "art/sc_fortune.webp": "366034ae9dbf3428abacc3943d101f58dbbb94cec569598f5fe755abafe15e3e", "art/sc_galley.webp": "3a9d3555e18e95965b5b70704dde3f46c955ce1fc0fc4c753c5315c47eb76132", "art/sc_gotland.webp": "6d59f2208ebe913328c472ee52248b8a03c8abfe7744a2c1a2b1a966fc575a38", "art/sc_indian.webp": "c9496bb5fbe020e5a5188ab46f8432a10b665861a6dda2056d9742d959340ec3", "art/sc_isle.webp": "cc445c4d1b3c962a82228254f7cc9bdff5854f55c619f538c182c511ab0944ef", "art/sc_kraken.webp": "797cdcbd09b4c62dc47d17b346657ce074d36e99ead2fe81246c355111dc2744", "art/sc_lighthouse.webp": "6a573b46b1dca53dbec82b07d215bfe3030886a9f02b0a17fe624d594473073a", "art/sc_med.webp": "1d8e99c070059aad5a8b3216dc983440ab8c51b3991358987faffb38de7ecef7", "art/sc_north.webp": "ec9d3812661263567ab2775a95b0281235a24167ebbe62eda7dd9fe361f575f7", "art/sc_oak.webp": "214d0dbec02661c0a5ee9752e79f087bc92199bb4cb1a0b9113300193fd3ec41", "art/sc_pacific.webp": "f244897d403c4c0fcc0f81de98b0fe823ac7cca4ec91f1f1a65b8ece737c6ad1", "art/sc_port.webp": "42db4beca12ec69f111ca1bceafed7976de6f5a123917b32928803834788501f", "art/sc_qar.webp": "927f19b436f8796494b2399d8085a0c7bff22d05d5db55ad47706b947daf25da", "art/sc_shipyard.webp": "5ace00371b435b2ae2de30501221929f75344e8fc1fab15f312e02d3b07eb6cd", "art/sc_tavern.webp": "816d5577379d574e2f2e6f6bfd779c0715b1037022308f807f989b7e915e121c", "art/sc_whirlpool.webp": "1d3e518b7daef1058964d125fe2a2319c0d11e268d7c4a97c90904057a6505b5", "art/sc_whydah.webp": "5ce3c71dbad1520b9bb4272c803fb829b34b35169e680bf36302a40623c3994a", "art/t_archer_2.webp": "bd8abfc4c2cf0dab903667bb72b380fc163f3ecee84452fa8daf139aa84b8ff8", "art/t_palisade.webp": "981176e3cd056f3ae1fadaad7b622a6624b4222a0a8c6c3e29e5b3e5c4d79a6e", "art/ui_book.webp": "660df4fc3093dd003098ab7ddbb5055ca3bd1ee0cc200bf5eb18e75eb523b98a", "art/ui_chest_wood.webp": "f10972c46c2c2f72a65a945f382483bae256fa17a0de19a07e38631c69b6e274", "art/ui_chest_wood_o.webp": "2871c913c312a7d1d2096c4a6136d4889d95ffdeb82168beb1f3ce82ed80ac0d", "art/ui_coin.webp": "a9585539679f1d3d8bb68b1145733e9881bf01cefdc73b411ea51cb476827e05", "art/ui_coinbag.webp": "134ff0fce08e9c8f5f92b5e68a61dd17cfd3bb44caf3be7b765572c5bcbb02eb", "art/ui_feather.webp": "2711212dd669123cf1a5cbe203c8597f22113bab32d7ff05cb5aacd4e3837ecb", "art/ui_page.webp": "c75d42c0a39e23ae33ea52f8bf6f40683bbcf09456f7cb8bbec615008d5ec9c5", "vendor/GLTFLoader.min.js": "d218cdd18cdf294e1829f8ad67abf09bbb9600660c6cca87c96358d569bfe35c", "vendor/three.min.js": "8a5f7249903b54d30f79f708699d2fed2d6a1d0741a4cd41377d1f01bb5a2271"};
const PAGE = 'mamuli-page-' + VERSION, FILES = 'mamuli-files-v2', FONTS = 'mamuli-fonts';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'rt.js'];
const LIB = ['vendor/three.min.js', 'vendor/GLTFLoader.min.js'];
const SCOPE = new URL(self.registration.scope), META = new URL('__asset_manifest__', SCOPE).href;
const artNames = new Set(ARTS), desktopArts = ARTS.filter(name => !name.startsWith('mobile/'));
const profileEntries = {
  desktop: desktopArts.map(name => new URL('art/' + name, SCOPE).href),
  mobile: desktopArts.map(name => new URL('art/' + (artNames.has('mobile/' + name) ? 'mobile/' + name : name), SCOPE).href)
};
// Activation retains both profiles; each client prepares only the models it uses.
const entries = ARTS.map(name => new URL('art/' + name, SCOPE).href);
const preparations = new Map(), clientProfiles = new Map();
const tasks = new Map(), queue = [], migrations = [];
let networkActive = 0, backgroundActive = 0, foregroundDemand = 0, migrationActive = false;
function preparation(profile) {
  if (!preparations.has(profile)) preparations.set(profile, { run: null, progress: { done: 0, total: profileEntries[profile].length, bytes: 0, failed: 0, running: false, complete: false } });
  return preparations.get(profile);
}
const clientKey = source => source && (source.id || source);
function requestProfile(data, source) {
  const key = clientKey(source), explicit = data && (data.profile === 'mobile' || data.profile === 'desktop') ? data.profile : null;
  const profile = explicit || clientProfiles.get(key) || 'desktop';
  if (key) clientProfiles.set(key, profile);
  return profile;
}
let assetCachePromise = null;
const assetCache = () => assetCachePromise || (assetCachePromise = caches.open(FILES).catch(error => { assetCachePromise = null; throw error; }));
function assetKey(input) {
  const url = new URL(typeof input === 'string' ? input : input.url, SCOPE);
  const relative = url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname) ? url.pathname.slice(SCOPE.pathname.length) : url.pathname;
  const revision = ASSET_REVISIONS[relative] || 'build-' + VERSION;
  url.hash = ''; url.search = ''; url.searchParams.set('v', revision); return url.href;
}
const bytesOf = response => Math.max(0, Number(response && response.headers.get('content-length')) || 0);
const cacheMatch = (cache, key, options) => cache.match(key, options).catch(() => null);
function unavailable() { return new Response('', { status: 504, statusText: 'Asset unavailable offline' }); }
function ready(response, bytes = bytesOf(response)) {
  // Consumers reopen their own CacheStorage stream. Never tee a cached 19MB
  // response into an unread original body merely to return its clone.
  if (response.body) response.body.cancel().catch(() => {});
  return { bytes, stored: true };
}

// One timeout covers headers and the cache write/body, so an interrupted stream
// cannot occupy a download slot forever. A failed key is removed and can retry.
async function deadline(run, milliseconds) {
  const controller = new AbortController(); let timer;
  try {
    return await Promise.race([run(controller.signal), new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('Download timed out')); }, milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
function pump() {
  while (networkActive < 4 && queue.length) {
    let index = queue.findIndex(job => !job.task.background);
    if (index < 0) { if (foregroundDemand || backgroundActive >= 2) return; index = 0; }
    const job = queue.splice(index, 1)[0], background = job.task.background;
    networkActive++; if (background) backgroundActive++;
    Promise.resolve().then(job.run).then(job.resolve, job.reject).finally(() => {
      networkActive--; if (background) backgroundActive--; pump();
    });
  }
}
function queued(task, run) { return new Promise((resolve, reject) => { queue.push({ task, run, resolve, reject }); pump(); }); }
function pumpMigration() {
  if (migrationActive || !migrations.length) return;
  const foreground = migrations.findIndex(job => !job.task.background), job = migrations.splice(foreground < 0 ? 0 : foreground, 1)[0];
  migrationActive = true;
  Promise.resolve().then(job.run).then(job.resolve, job.reject).finally(() => { migrationActive = false; pumpMigration(); });
}
function serialMigration(task, run) { return new Promise((resolve, reject) => { migrations.push({ task, run, resolve, reject }); pumpMigration(); }); }
async function legacyNames() { return (await caches.keys()).filter(name => name === 'mamuli-files' || (name.startsWith('mamuli-files-') && name !== FILES)).reverse(); }
async function migrate(task, cache, request, key) {
  const revision = new URL(key).searchParams.get('v');
  if (!/^[a-f0-9]{64}$/.test(revision) || !self.crypto || !self.crypto.subtle) return null;
  // At most one legacy body is hashed at a time, including the 19MB volcano.
  return serialMigration(task, async () => {
    for (const name of await legacyNames()) {
      const old = await caches.open(name), response = await cacheMatch(old, request.url, { ignoreSearch: true });
      if (!response || !response.ok || response.type === 'opaque') continue;
      try {
        const body = await response.arrayBuffer(), digest = await self.crypto.subtle.digest('SHA-256', body);
        const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
        if (hash !== revision) continue;
        const headers = new Headers(response.headers); headers.delete('content-encoding'); headers.set('content-length', String(body.byteLength));
        await cache.put(key, new Response(body, { status: response.status, statusText: response.statusText, headers }));
        const hit = await cacheMatch(cache, key); if (hit) return ready(hit, body.byteLength);
      } catch (_) { }
    }
    return null;
  });
}
async function offlineAsset(cache, request) {
  // An older revision can still make an offline game playable, but is never
  // promoted to the current revision unless its actual bytes have been verified.
  const sameFile = await cacheMatch(cache, request.url, { ignoreSearch: true }); if (sameFile) return sameFile;
  for (const name of await legacyNames()) { const old = await caches.open(name), hit = await cacheMatch(old, request.url, { ignoreSearch: true }); if (hit) return hit; }
  return null;
}
async function prepareAsset(task, request, key) {
  let cache;
  try { cache = await assetCache(); } catch (_) { }
  if (cache) {
    const hit = await cacheMatch(cache, key); if (hit) return ready(hit);
    try { const migrated = await migrate(task, cache, request, key); if (migrated) return migrated; } catch (_) { }
  }
  try {
    return await queued(task, () => deadline(async signal => {
      const response = await fetch(key, { signal, credentials: request.credentials || 'same-origin', mode: request.mode === 'no-cors' ? 'no-cors' : 'cors' });
      if (!response.ok && response.type !== 'opaque') return { response, bytes: 0, stored: false };
      let stored = false;
      if (cache) { try { await cache.put(key, response.clone()); stored = true; } catch (_) { } }
      return stored ? ready(response) : { response, bytes: bytesOf(response), stored: false };
    }, /\.glb(?:\?|$)/.test(key) ? 90000 : 25000));
  } catch (_) {
    let fallback = null; if (cache) { try { fallback = await offlineAsset(cache, request); } catch (_) { } }
    return { response: fallback || unavailable(), bytes: bytesOf(fallback), stored: false };
  }
}
async function asset(request, background = false) {
  const key = assetKey(request); if (!background) foregroundDemand++;
  try {
    let task = tasks.get(key);
    if (!task) {
      task = { background, promise: null }; tasks.set(key, task);
      task.promise = prepareAsset(task, request, key).catch(() => ({ response: unavailable(), bytes: 0, stored: false })).finally(() => { if (tasks.get(key) === task) tasks.delete(key); });
    } else if (!background) { task.background = false; pump(); pumpMigration(); }
    const result = await task.promise;
    // Background callers do not create an unused clone of a large model body.
    if (background) return result;
    if (result.stored) { try { return await cacheMatch(await assetCache(), key) || unavailable(); } catch (_) { return unavailable(); } }
    return result.response.clone();
  } finally { if (!background) { foregroundDemand--; pump(); } }
}
async function tell(profile, source) {
  const message = { type: 'asset-cache-progress', version: VERSION, profile, ...preparation(profile).progress };
  if (source && source.postMessage) { source.postMessage(message); return; }
  try {
    for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) {
      const requested = clientProfiles.get(clientKey(client));
      if (!requested || requested === profile) client.postMessage(message);
    }
  } catch (_) { }
}
async function status(profile, source) {
  const state = preparation(profile), selected = profileEntries[profile];
  if (!state.run) {
    try {
      const cache = await assetCache(), keys = new Set((await cache.keys()).map(request => request.url));
      const done = selected.filter(url => keys.has(assetKey(url))).length;
      state.progress = { ...state.progress, done, total: selected.length, running: false, complete: done === selected.length, failed: Math.min(state.progress.failed, selected.length - done) };
    } catch (_) { state.progress = { ...state.progress, running: false, complete: false }; }
  }
  await tell(profile, source);
}
function keepAll(profile) {
  const state = preparation(profile), selected = profileEntries[profile];
  if (state.run) return state.run;
  state.run = (async () => {
    let keys = new Set(); try { keys = new Set((await (await assetCache()).keys()).map(request => request.url)); } catch (_) { }
    const todo = selected.filter(url => !keys.has(assetKey(url)));
    const progress = state.progress = { done: selected.length - todo.length, total: selected.length, bytes: 0, failed: 0, running: true, complete: false }; await tell(profile);
    const next = async () => {
      for (let url = todo.shift(); url; url = todo.shift()) {
        const result = await asset(new Request(url), true);
        if (result.stored) { progress.done++; progress.bytes += result.bytes; } else progress.failed++;
        await tell(profile);
      }
    };
    // Different profiles share asset tasks and the same two background streams.
    await Promise.all([next(), next()]);
    progress.running = false; progress.complete = progress.done === progress.total && progress.failed === 0;
    // Legacy data may still supply another profile. Remove it only once every
    // current revision is covered, not when one phone's smaller set completes.
    if (progress.complete) {
      try {
        const currentKeys = new Set((await (await assetCache()).keys()).map(request => request.url));
        if (entries.every(url => currentKeys.has(assetKey(url)))) for (const name of await legacyNames()) await caches.delete(name);
      } catch (_) { }
    }
    await tell(profile);
  })().catch(async () => { state.progress.running = false; state.progress.complete = false; state.progress.failed++; await tell(profile); }).finally(() => { state.run = null; });
  return state.run;
}
async function page(request) {
  let cache; try { cache = await caches.open(PAGE); } catch (_) { }
  try {
    return await deadline(async signal => {
      const response = await fetch(request, { cache: 'no-cache', signal });
      if (response.ok && cache) { try { await cache.put(request, response.clone()); } catch (_) { } }
      return response;
    }, 8000);
  } catch (_) { return (cache && (await cacheMatch(cache, request, { ignoreSearch: true }) || (request.mode === 'navigate' && (await cacheMatch(cache, new URL('index.html', SCOPE).href) || await cacheMatch(cache, SCOPE.href))))) || unavailable(); }
}
async function font(request) {
  try {
    const cache = await caches.open(FONTS), hit = await cacheMatch(cache, request); if (hit) return hit;
    return await deadline(async signal => { const response = await fetch(request, { signal }); if (response.ok || response.type === 'opaque') { try { await cache.put(request, response.clone()); } catch (_) { } } return response; }, 15000);
  } catch (_) { return unavailable(); }
}

function installError(code) { const error = new Error(code); error.code = code; return error; }
async function installMessage(state, detail) {
  try { for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) client.postMessage({ type: 'asset-cache-install-status', version: VERSION, state, detail }); } catch (_) { }
}
async function installShell() {
  await installMessage('installing', 'start');
  try {
    const cache = await caches.open(PAGE); let verified = false;
    // The two page URLs are the same generated document. One versioned download
    // saves a second large HTML transfer while the previous worker still runs.
    // Never label a stale CDN page as this worker's current offline shell.
    for (let attempt = 0; attempt < 2 && !verified; attempt++) {
      try {
        await deadline(async signal => {
          const url = new URL('index.html', SCOPE); url.searchParams.set('sw', VERSION); if (attempt) url.searchParams.set('retry', String(attempt));
          const response = await fetch(url.href, { cache: 'reload', signal, priority: 'high' });
          if (!response.ok) throw installError('shell-response-error');
          const html = await response.text(), match = /\bconst\s+BUILD\s*=\s*["']([^"']+)["']\s*;/.exec(html);
          if (!match || match[1] !== VERSION) throw installError('page-version-mismatch');
          const headers = new Headers(response.headers); headers.delete('content-encoding'); headers.delete('content-length');
          const pageResponse = () => new Response(html, { status: response.status, statusText: response.statusText, headers });
          await cache.put(new URL('index.html', SCOPE).href, pageResponse()); await cache.put(SCOPE.href, pageResponse()); verified = true;
        }, 90000);
      } catch (error) { if (attempt === 1) throw error; }
    }
    await installMessage('page-ready', 'verified-current-page');
    // Two small shell transfers at once leave bandwidth for the running game.
    const remaining = SHELL.filter(path => path !== './' && path !== 'index.html');
    const next = async () => {
      for (let path = remaining.shift(); path; path = remaining.shift()) await deadline(async signal => {
        const url = new URL(path, SCOPE).href, response = await fetch(url, { cache: 'no-cache', signal });
        if (!response.ok) throw installError('shell-response-error'); await cache.put(url, response);
      }, 90000);
    };
    await Promise.all([next(), next()]); await installMessage('shell-ready', 'offline-shell-cached');
    const libraries = await Promise.all(LIB.map(path => asset(new Request(new URL(path, SCOPE).href))));
    if (libraries.some(response => !response.ok)) throw installError('offline-libraries-unavailable');
    await installMessage('ready', 'offline-libraries-ready'); await self.skipWaiting();
  } catch (error) {
    const detail = error.code || (error.message === 'Download timed out' ? 'download-timeout' : ['QuotaExceededError', 'NotAllowedError', 'SecurityError'].includes(error.name) ? 'storage-error' : 'install-error');
    await installMessage('failed', detail); throw error;
  }
}
self.addEventListener('install', event => event.waitUntil(installShell()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  // Manifest housekeeping must not prevent an installed worker from activating
  // when storage becomes full. Gameplay can still use network-only responses.
  try {
    const cache = await assetCache(), current = entries.concat(LIB.map(path => new URL(path, SCOPE).href)).map(assetKey);
    let previous = []; try { const old = await cacheMatch(cache, META); if (old) { const manifest = await old.json(); previous = Array.isArray(manifest.keys) ? manifest.keys : []; } } catch (_) { }
    const retain = new Set([...current, ...previous, META]);
    for (const request of await cache.keys()) if (!retain.has(request.url)) await cache.delete(request);
    await cache.put(META, new Response(JSON.stringify({ version: VERSION, keys: current }), { headers: { 'content-type': 'application/json' } }));
  } catch (_) { }
  try { for (const name of await caches.keys()) if (name.startsWith('mamuli-page-') && name !== PAGE) await caches.delete(name); } catch (_) { }
  await self.clients.claim();
})()));
self.addEventListener('message', event => {
  const type = typeof event.data === 'string' ? event.data : event.data && event.data.type;
  if (type === 'keep-all') event.waitUntil(keepAll(requestProfile(event.data, event.source)));
  else if (type === 'cache-status') event.waitUntil(status(requestProfile(event.data, event.source), event.source));
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url); if (request.method !== 'GET') return;
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') { event.respondWith(font(request)); return; }
  if (url.origin !== SCOPE.origin) return;
  if (url.pathname.includes('/art/') || url.pathname.includes('/vendor/')) { event.respondWith(asset(request)); return; }
  if (request.mode === 'navigate' || SHELL.some(path => path !== './' && url.pathname.endsWith('/' + path))) event.respondWith(page(request));
});
