# Reconciliation — printed English index vs `lagu_sion.db`

Source: *Lagu Sion*, "Judul-Judul Lagu Dalam Bahasa Inggris Secara Abjadiah", pp. 561–567.
Compared against `songs.number` / `songs.english_title` in `lagu_sion.db`.

## Summary

| | Count |
|---|---:|
| Hymns in DB | 525 |
| Entries in printed English index | 522 |
| Titles matching after normalization | 450 |
| Wording differs, same hymn | 72 |
| No English title in either source (LS 229, 491, 501) | 3 |

## Already applied

**To the index files** — 7 numbers I had transcribed one line out of register; the Indonesian titles in the DB settle each one:

| Title | Was | Now | Indonesian title (proof) |
|---|--:|--:|---|
| Savior, Like a Shepherd | 150 | **35** | Yesus Bagaikan Gembala |
| Saviour, Thy Dying Love | 35 | **215** | Ya Tuhan, Engkau T'lah Mati |
| Shall We Gather at the River | 215 | **170** | Akan Berkumpulkah Kita |
| Shall You? Shall I? | 170 | **291** | Siapa Masuk Pintu Gerbang? |
| Showers of Blessing | 291 | **150** | Seg'ra Datang Hujan Berkat |
| I Will Never Leave Thee | 145 | **253** | Aku Tak Akan Tinggalkan |
| I Will Sing of Jesus' Love | 253 | **145** | Ku Akan Menyanyikan |

**To the database** (23 rows; backup at `lagu_sion.db.bak-before-english-index-sync`):

- 15 rows: decoded `&#39;` HTML entities in `english_title` (LS 92, 96, 102, 110, 125, 141, 148, 164, 166, 234, 322, 331, 378, 447, 493).
- 5 rows: filled an empty `english_title` from the index — LS 33 *Wake the Song*, 76 *Eternal Father, Strong to Save*, 300 *O Wait and Murmur Not*, 325 *Where are the Reapers?*, 418 *All Things Come of Thee*.
- LS 95 and 182: `english_title` held the Indonesian title with the hymn number prefixed; replaced with the printed English titles.
- LS 518 *Sucilah Tuhan*: `english_title` wrongly duplicated hymn 13's *Holy, Holy, Holy*; corrected to *Holy is the Lord*.

## Open for your call

### A. One-word / one-letter differences (32)

Same hymn, same length — one side has a slip. Most are DB scrape errors (*Behovah's*, *Loght*, *Sheperd*, *Gorth*, *Belivers*, *Never Falls*, *Bread Thou the Bread*), but a few are the book's own printing (*Betlehem*, *All Creature*, *The Strike is O'er*, *Savely*), which the index files keep verbatim. Skim and tell me which way to sync each.

| LS | Indonesian | Printed index | DB `english_title` |
|--:|---|---|---|
| 1 | Di Hadapan Hadirat-Mu | Before Jehovah's Awful Throne | Before Behovah's Awful Throne |
| 2 | Hai Segnap Ciptaan Tuhan | All Creature of Our God and King | All Creatures Of Our God And King |
| 9 | Hai Kristen Nyanyilah | Come Christians, Join to Sing | Come Christian, Join To Sing |
| 47 | Dengan Lembut Trang Siang | Softly Now the Light of Day | Softly Now The Loght Of Day |
| 50 | Yesus Gembala, Dengarlah | Jesus, Tender Shepherd, Hear Me | Jesus, Tender Sheperd, Hear Me |
| 59 | Tuhan Jadikanlah Kami Lebih Suci | Lord, Make Me More Holy | Lord, Make Us More Holy |
| 72 | Besar Kasih-Mu Ya Allah | O Love That Wilt Not Let Me Go | O Love That Wilt Not Le Me Go |
| 74 | Karna Demikian Besar Kasih-Nya | For God So Love Us | For God So Loved Us |
| 81 | Hai Mlaikat Suci Di Surga | Ye Watches and Ye Holy Ones | Ye Watchers And Ye Holy Ones |
| 115 | Hai Betlehem Yang Senyap | O Little Town of Betlehem | O Little Town Of Bethlehem |
| 122 | Bila Ku Renungkan | I Think When I Read the Sweet Story | I Think When I Read That Sweet Story |
| 135 | Haleluya! Puji Yesus | Alleluya! Sing to Jesus! | Alleluia! Sing To Jesus |
| 141 | Perjuangan Berakhirlah | The Strike is O'er | The Strife Is O'er |
| 151 | Gembala Agung, Engkau Milikku | O Shepherd Divine | O Sheperd Divine |
| 189 | Pandanglah Yesus, Ya Bapaku | Look Upon Jesus Sinless in He | Look Upon Jesus Sinless Is He |
| 204 | Brikanlah, Ya Tuhan | Break Thou the Bread of Life | Bread Thou The Bread Of Life |
| 209 | Yesus Sedang Berdiri | O Jesus, Thou Art Standing | Oh Jesus Thou Art Standing |
| 220 | Haruskah Yesus Sendiri? | Must Just Bear the Cross Alone | Must Jesus Beat The Cross Alone |
| 231 | Meski Aku Durhaka | Chief of Sinner Thought I Be | Chief Of Sinners Though I Be |
| 236 | Iman Orang Saleh Kekal | Faith of Our Father | Faith If Our Fathers |
| 296 | Nama Yesus Amat Indah | Jesus O How Sweet The Name | Jesus Oh How Sweet The Name |
| 337 | Maju Serta Yesus | Go Forth, Go Forth with Jesus | Go Forth, Go Gorth With Jesus |
| 343 | Enam Hari Sudah Lalu | Another Six Day Work is Done | Another Six Days Work Is Done |
| 406 | Beban Terangkat Di Kalvari | Burden are Lifted at Calvary | Burdens Are Lifted At Calvary |
| 416 | Ku Perlu Engkau, Yesus | I Need Thee, Precious Jesus | I Need The, Precious Jesus |
| 429 | Berjagalah Skarang | Watch an Pray | Watch And Pray |
| 435 | Jalan Serta Yesus Slalu Sejahtra | Anywhere With Jesus I Can Savely Go | Anywhere With Jesus I Can Safely Go |
| 446 | Allah Utus Yesus Putra-Nya | Because He Loves | Because He Lives |
| 452 | Yesus Tak Pernah Gagal | Jesus Never Fails | Jesus Never Falls |
| 473 | Pada Masa Seperti Skarang | In Times Like These | In Times Like This |
| 482 | Bergembiralah Kamu | Rejoice, Rejoice Believers | Rejoice, Rejoice, Belivers |
| 494 | Di Dalam Sengsara Dan Keluhanku | Mid Pleasure and Palaces | Mid Pleasures And Palaces |

### B. DB title is fuller — the printed index truncates the line (17)

Nothing to fix; the index simply drops the tail to fit the column. Keep the DB value.

| LS | Printed index | DB `english_title` |
|--:|---|---|
| 55 | Lord, Dismiss Us With Thy Blessing | Lord, Dismiss Us With Thy Blessings |
| 78 | Lord of All Nation | Lord Of All Nations |
| 105 | Hark! The Herald Angels Sing | Hark! The Herald Angels Sings |
| 113 | We Three King | We Three Kings |
| 118 | While Shepherds Watched Their | While Shepherds Watched Their Flocks |
| 130 | When I Survey | When I Survey The Wondrous Cross |
| 166 | 'Tis Almost Time for the Lord | 'tis Almost Time For The Lord To Come |
| 169 | When the Roll is Called Up | When The Roll Is Called Up Yonder |
| 307 | Watchman, Blow the Gospel | Watchman, Blow The Gospel Trumpet |
| 314 | When Cross the Crowded Ways | When Cross The Crowded Ways Of Life |
| 346 | As Birds Unto the Genial | As Birds Unto The Genial Homeland |
| 376 | Holy, Holy, is What the Angels | Holy, Holy, Is What The Angels Sing |
| 382 | Long Upon the Mountain | Long Upon The Mountains |
| 417 | Fill My Cup | Fill My Cup, Lord |
| 437 | He Cannot Fail for He is | He Cannot Fail For He Is God |
| 442 | I Know Whom I Have | I Know Whom I Have Believed |
| 470 | I'll Go Where You Want | I'll Go Where You Want Me To Go |

### C. Genuine wording differences — needs a human eye (23)

| LS | Indonesian | Printed index | DB `english_title` |
|--:|---|---|---|
| 4 | Puji Tuhan | Praise Ye the Lord | Praise To The Lord |
| 29 | Puji Allah Yang Bertakhta | Sing Praise to the Lord | Sing Praise To God |
| 133 | Pandanglah Penebus Kita | Look, Ye Saints! The Sight Is | Look, You Saints! The Sight Is Glorious |
| 187 | Beribu Lidah Bernyanyi | O For a Thousand Tongues to Sing | O For Thousand Tongues To Sing |
| 198 | Brilah Roh-Mu Tuhan | Breathe on Me, Breathe of God | Breathe On Me Of God |
| 219 | Yesus Batu Zaman | Hiding In Thee | Hide In Thee |
| 223 | Yesus Panggil, Aku Ikut | Jesus Call's Me, I Follow | Jesus Calls Me, I Must Follow |
| 250 | Yesus, Ku Pikul Salibku | Jesus, My Cross Have Taken | Jesus, I My Cross Have Taken |
| 266 | Bawa Sgala Persepuluhanmu | Bring Ye All the Tithes | Bring Ye All Tithes, Mal. 3:10 |
| 278 | Di Tepian Sungai Yordan | On Jordan Storm Banks | On Jordan's Storm Banks |
| 304 | Dengarlah Suara Yesus | Hark! The Voice of Jesus Calling | Hark! The Voice Of Jesus |
| 308 | Biarkan Aku Pergi | Missionary Farewell | Missionary's Farewell |
| 322 | Dari Timur Dan Barat | From Greenlands Icy Mountains | From Greenland's Icy Mountains |
| 335 | Dalam Kerja Rajaku | In the Service of the King | In The Service The King |
| 384 | Ku Berkelana | I'm a Pilgrim | I'm Pilgrim |
| 385 | Kita Hidup Skarang Ini | To be Living is Sublime | To Be Living Sublime |
| 424 | Kuperlu Doa Kasihku | Need the Prayers | I Need The Prayers |
| 443 | Aku Membangun Harapan | My Hope is Build on Nothing Less | My Hope Built On Nothing Less |
| 454 | Hatiku Rindu | I've Longing in My Heart for Jesus | I've A Longin In My Heart For Jesus |
| 484 | Aku Senang Dan Girang Selalu | I'm So Happy an Here the Reason Why | I'm So Happy And Here's The Reason Why |
| 506 | Semua Orang Harus Tau | Every Body Ought to Know Jesus | Everybody Ought To Know Jesus |
| 519 | Tuhan Memberkati Dan Melindungimu | The Lord Bless You and Keep You | The Lord Bless You Keep You |
| 521 | Kiranya Allah Dalam Pikiranku | God Be My Head | God Be In My Head |

## Notes

- **LS 229 (*Janganlah Bersedih*), 491 (*Di Rumah*), 501 (*Kumpulan Orang Muda*)** are absent from the printed English index and have no `english_title` in the DB — consistent on both sides, so the index at 522 entries is complete, not short.
- **LS 130 and 281** both carry *When I Survey The Wondrous Cross* in the DB, but they are different hymns (*Bila Ku Pandang Salib-Mu* vs *Bila Pandang Salib Yesus*); the index lists 130 as *When I Survey* and 281 as *When I Survey the Wondrous Cross*.
- Three titles appear twice in the printed index, as they do in the book: *Live Out Thy Life Within Me* (244, 333), *What a Friend We Have in Jesus* (422, 496), *Jesus Lover of My Soul* (227, 413).
- Typographic errors in the book itself are kept verbatim in the index files: "Savely", "Betlehem", "We Three King", "The Strike is O'er".
