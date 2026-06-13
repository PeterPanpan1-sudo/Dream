CREATE TABLE accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      password TEXT,
      access_token TEXT,
      refresh_token TEXT,
      expires_at DATETIME,
      type TEXT DEFAULT 'free',
      status TEXT DEFAULT 'active',
      quota INTEGER DEFAULT 0,
      used_count INTEGER DEFAULT 0,
      recovery_time DATETIME,
      last_used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
INSERT INTO "accounts" ("id", "email", "password", "access_token", "refresh_token", "expires_at", "type", "status", "quota", "used_count", "recovery_time", "last_used_at", "created_at", "updated_at") VALUES (4, 'amieorissette@edu.peterlinux.com', NULL, 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjE5MzQ0ZTY1LWJiYzktNDRkMS1hOWQwLWY5NTdiMDc5YmQwZSIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS92MSJdLCJjbGllbnRfaWQiOiJhcHBfWDh6WTZ2VzJwUTl0UjNkRTduSzFqTDVnSCIsImV4cCI6MTc4MjE0NjA4NiwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS9hdXRoIjp7ImNoYXRncHRfYWNjb3VudF9pZCI6ImIwMjZlOTczLWY5YTctNDYyOC05ODBmLTcxM2I1ODdhZGM0OCIsImNoYXRncHRfYWNjb3VudF91c2VyX2lkIjoidXNlci14dGxuRzd5QmNRYnhZdHo2NWVWczI4RjlfX2IwMjZlOTczLWY5YTctNDYyOC05ODBmLTcxM2I1ODdhZGM0OCIsImNoYXRncHRfY29tcHV0ZV9yZXNpZGVuY3kiOiJub19jb25zdHJhaW50IiwiY2hhdGdwdF9wbGFuX3R5cGUiOiJmcmVlIiwiY2hhdGdwdF91c2VyX2lkIjoidXNlci14dGxuRzd5QmNRYnhZdHo2NWVWczI4RjkiLCJpc19zaWdudXAiOnRydWUsInVzZXJfaWQiOiJ1c2VyLXh0bG5HN3lCY1FieFl0ejY1ZVZzMjhGOSJ9LCJodHRwczovL2FwaS5vcGVuYWkuY29tL3Byb2ZpbGUiOnsiZW1haWwiOiJhbWllb3Jpc3NldHRlQGVkdS5wZXRlcmxpbnV4LmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlfSwiaWF0IjoxNzgxMjgyMDg1LCJpc3MiOiJodHRwczovL2F1dGgub3BlbmFpLmNvbSIsImp0aSI6ImUyZmEyYWI3LTQ5YTktNGY5YS1hOGE4LTM4ZmUxNjI5M2M5MyIsIm5iZiI6MTc4MTI4MjA4NSwicHdkX2F1dGhfdGltZSI6MTc4MTI4MjA4MzAwNSwic2NwIjpbIm9wZW5pZCIsImVtYWlsIiwicHJvZmlsZSIsIm9mZmxpbmVfYWNjZXNzIiwibW9kZWwucmVxdWVzdCIsIm1vZGVsLnJlYWQiLCJvcmdhbml6YXRpb24ucmVhZCIsIm9yZ2FuaXphdGlvbi53cml0ZSJdLCJzZXNzaW9uX2lkIjoiYXV0aHNlc3NfOXhHTkl5Yzc3Z1loOUpBUjZvZFBlRHh5Iiwic2wiOnRydWUsInN1YiI6ImF1dGgwfGxZTnlDY29HV2ZMNzBYZ0pNVXBtcHFrSiJ9.DAOxVUD0WsGB-n8UDJty6hJbgoHZE5zWPQunNXxUZV0p9rUwWmnBp68hUqEnKmPosraALjiQJQpTyQjdcUei80Ele9ugiSlKIDeehZgI-A7zYc1unzb1oumTVS_yXf5UGXiIXF93cUyflG57EnyBiBw0wfS7isxItskIZ_7NZEilTA1oZ1aKfl6Q1d0QgfCyBl8B52gFT8zciVwVjTJljg7Jb04yULpnieQXSmUTzgO9FHLNVKbMevtp6Tay0y19NLojk_JeaEWGuHoze8RswvhfbyFPqri0KxmdgdFu2jgyHdvAP3AGtmOSmWJ3q8RDU_nbP5O5QyF5oKMMU-NmGgqI6hat4LSMjjJMooLjXgA4oGf0yLAN3XF5Tdy1WG8iz-miuNsYMvV2GngsFp-tS3R-XLzZKES5mriDHe9tUzqwagM7LcvsTh372H2TnLpXaOSsk8838394ywM2XCG3RKnCaB_Gj3ZOIRuHXSU6NqCHylv4N9wHUhO7BNYrQFI9j8fdxDm44TOunpOUffrUTSdnVZ4zb0d8L-7ENx6vnlMjQj9N75u3im4HWfu5EvIsVj42OL7M4hHDb7Xd0h3HpWlFRzKnOk5DtECd8fvDYyHOWrrRjLsjg3bJ1zOslkVaJQt0UWVn1mUY6yTT8goyfBIzvYRiVI8DVN54vFUSRdY', NULL, NULL, 'free', 'active', 0, 6, NULL, '2026-06-13 04:54:40', '2026-06-13 02:23:15', '2026-06-13 02:23:15');
INSERT INTO "accounts" ("id", "email", "password", "access_token", "refresh_token", "expires_at", "type", "status", "quota", "used_count", "recovery_time", "last_used_at", "created_at", "updated_at") VALUES (5, 'heron93@edu.peterlinux.com', NULL, 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImFlNjc5NWRjLTRiYWUtNDE4YS04NjVkLTA4YTY0MzllZWRhNiIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS92MSJdLCJjbGllbnRfaWQiOiJhcHBfWDh6WTZ2VzJwUTl0UjNkRTduSzFqTDVnSCIsImh0dHBzOi8vYXBpLm9wZW5haS5jb20vYXV0aCI6eyJjaGF0Z3B0X2FjY291bnRfaWQiOiI5MjdlNTk5Yi1lMWFjLTRkYzMtOGI2ZS0wNjI4MzczNzE2MWEiLCJjaGF0Z3B0X2FjY291bnRfdXNlcl9pZCI6InVzZXItMDZwdm9LUENIbGppbUdEY1RRUnJDYXZpX185MjdlNTk5Yi1lMWFjLTRkYzMtOGI2ZS0wNjI4MzczNzE2MWEiLCJjaGF0Z3B0X2NvbXB1dGVfcmVzaWRlbmN5Ijoibm9fY29uc3RyYWludCIsImNoYXRncHRfcGxhbl90eXBlIjoiZnJlZSIsImNoYXRncHRfdXNlcl9pZCI6InVzZXItMDZwdm9LUENIbGppbUdEY1RRUnJDYXZpIiwiaXNfc2lnbnVwIjp0cnVlLCJ1c2VyX2lkIjoidXNlci0wNnB2b0tQQ0hsamltR0RjVFFSckNhdmkifSwiaHR0cHM6Ly9hcGkub3BlbmFpLmNvbS9wcm9maWxlIjp7ImVtYWlsIjoiaGVyb245M0BlZHUucGV0ZXJsaW51eC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZX0sImlzcyI6Imh0dHBzOi8vYXV0aC5vcGVuYWkuY29tIiwicHdkX2F1dGhfdGltZSI6MTc4MTMyNTE2ODkwMCwic2NwIjpbIm9wZW5pZCIsImVtYWlsIiwicHJvZmlsZSIsIm9mZmxpbmVfYWNjZXNzIiwibW9kZWwucmVxdWVzdCIsIm1vZGVsLnJlYWQiLCJvcmdhbml6YXRpb24ucmVhZCIsIm9yZ2FuaXphdGlvbi53cml0ZSJdLCJzZXNzaW9uX2lkIjoiYXV0aHNlc3Nfa1JRanNpZDdQdnJicVdVdGJpZ1N0bVpvIiwic2wiOnRydWUsInN1YiI6ImF1dGgwfDl0SHRXQjFxbkNMY2VHejJWekJjdlV2WCIsImlhdCI6MTc4MTMyNTE3MSwiZXhwIjoxNzgyMTg5MTcxLCJqdGkiOiIxMzI3MDgwMWZiMGM0YWJhODA4ODFhY2RhNjBlZGE0YiIsIm5iZiI6MTc4MTMyNTE3MX0.Yi70BsNdDE5PnkMvWqf1pDET0B-nQuS1dNNhw8kprd7S6-BLnmg6y1FpM54lUJ46v_xV1_T_MVnph7-Pwuwh2xiAgaepycoJg40RaMVzK0pzUNlJ8I9a2OpSJEaWKdqXNNqYIUB5w3Xyi5pqd9gLiMPatE0H687KnI7ugZBgeeCc0LPLHeyFXf8MKYQ3tvIy30BbztJVCNxHF3-r9kWhODHXQ7SilmFMDmeXlrtHx8CE_nurwy-MilAeMhGFAbFMyRUdqiMP7bm9DQziayLU3op5eyXl30MKh4rVxxFBxh_24ifC4QfKwxjnTMUhH2FTz-YMcKol_G1J6RnqWBL-zzsu0-Fh5imKRTi6S-P0eofj_YTDaLRg5XLnOjUCeKb1iu79V-79fsuQYT2kgFR4KtgFYZIOEuNrQaM58JITQb5b_NPlbMTBpGJ6RNb48kRRSOXuviYVlpIoxTDAsCJbXplaiYp66cPUyI12ElFepLNaYAGIWEsRAv0sB9FDMxMEjSPVq3tCmS3h8yGtvbQ4MjJ09Vix9sNqpm6aMCcGlF86kAlJ0GpCVAHQgO2e_pdGmLho-bUx9FAHleWnBKLRMAcwxexY4FdMFoxS34edubzlIkl8WwKgSmZjzaCqGqncXQTyZ5P8hLDnwhGZUwnNroLd78AMBeiOVU8P7lQAbLk', NULL, NULL, 'free', 'active', 0, 3, NULL, '2026-06-13 05:12:48', '2026-06-13 04:33:45', '2026-06-13 04:33:45');

CREATE TABLE image_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(image_id, user_id)
    );

CREATE TABLE images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      prompt TEXT NOT NULL,
      negative_prompt TEXT,
      model TEXT DEFAULT 'stable-diffusion',
      size TEXT DEFAULT '1024x1024',
      quality TEXT DEFAULT 'standard',
      url TEXT NOT NULL,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    , is_public INTEGER DEFAULT 1);
INSERT INTO "images" ("id", "user_id", "prompt", "negative_prompt", "model", "size", "quality", "url", "status", "created_at", "is_public") VALUES (5, 1, 'A 20-year-old East Asian girl with delicate, charming features and large, bright brown eyes—expressive and lively, with a cheerful or subtly smiling expression. Her naturally wavy long hair is either loose or tied in twin ponytails. She has fair skin and light makeup accentuating her youthful freshness. She wears a modern, cute dress or relaxed outfit in bright, soft colors—lightweight fabric, minimalist cut. She stands indoors at an anime convention, surrounded by banners, posters, or stalls. Lighting is typical indoor illumination—no staged lighting—and the image resembles a casual iPhone snapshot: unpretentious composition, yet brimming with vivid, fresh, youthful charm.

严格遵循主体、构图、材质和风格描述，不要偏离核心意图。

严格遵循主体、构图、材质和风格描述，不要偏离核心意图。', NULL, 'gpt-image-2', '1024x1024', 'standard', 'https://picsum.photos/seed/1781284229045/1024/1024', 'completed', '2026-06-12 17:10:29', 1);
INSERT INTO "images" ("id", "user_id", "prompt", "negative_prompt", "model", "size", "quality", "url", "status", "created_at", "is_public") VALUES (6, 1, 'A photorealistic medium shot of a beautiful 23-year-old South Korean office lady (OL) inside a modern elevator. She has charming and captivating eyes looking directly into the camera, elegant makeup. She is wearing a chic and elegant strapless tube top under a stylish open blazer, showcasing a curvaceous and well-proportioned figure. The elevator interior has sleek metallic panels with soft, warm ambient lighting and subtle reflections. Cinematic lighting, photorealistic, 8k resolution, captured on a 35mm lens, realistic skin texture, highly detailed. --ar 3:4 --style raw --v 6.0

严格遵循主体、构图、材质和风格描述，不要偏离核心意图。', NULL, 'gpt-image-2', '1024x1024', 'standard', '/uploads/1781317443999_0_phe1v3.png', 'completed', '2026-06-13 02:24:04', 0);
INSERT INTO "images" ("id", "user_id", "prompt", "negative_prompt", "model", "size", "quality", "url", "status", "created_at", "is_public") VALUES (7, 1, '根据【末日时在做什么？有没有空？可以来拯救吗？】自动生成一张收藏版史诗叙事海报：巨大的【珂朵莉·诺塔·瑟尼欧里斯】侧脸剪影作为外轮廓，剪影内部自动生长出最契合该主题的完整世界观、标志性场景（浮空岛）、角色关系、象征符号、关键建筑（妖精仓库）、生物、道具与氛围。请注意人物形象和基本特征，确保正确。整体不是普通拼贴，而是高级的剪影轮廓填充式叙事合成，带有双重曝光式联想，但更偏电影海报与梦幻水彩插画融合风格；柔和空气透视，轻雾化过渡，纸张颗粒，边缘飞白与刷痕，大面积留白，版式克制高级，安静、宏大、神圣、怀旧、诗意、传说感。风格、色彩、场景、材质全部根据主题自动适配，所有元素必须强绑定主题，一眼识别，不要杂乱，不要硬拼贴，不要模板化背景，不要廉价奇幻素材。 严格遵循主体、构图、材质和风格描述，不要偏离核心意图。(已给出一张珂朵莉参考图，一张圣剑瑟尼欧里斯参考图【上部分是线稿，下部分是成图，生成时不要使用圣剑的线稿】，一张妖精仓库参考图，一张浮空岛参考图，一张全人物参考图) 严格遵循主体、构图、材质和风格描述，不要偏离核心意图。

严格遵循主体、构图、材质和风格描述，不要偏离核心意图。', NULL, 'gpt-image-2', '1024x1024', 'standard', '/uploads/1781317671023_0_xoswcg.png', 'completed', '2026-06-13 02:27:51', 1);
INSERT INTO "images" ("id", "user_id", "prompt", "negative_prompt", "model", "size", "quality", "url", "status", "created_at", "is_public") VALUES (8, 1, 'Boyfriend’s perspective: Girlfriend is drunk, cosplay of Boa hancock, he cups her face in one hand, a beautiful Korean girl, the camera angle is from top to bottom, her eyes are hazy but full of love, Messy hair, the room is dimly lit, amateurish iPhone shot.

严格遵循主体、构图、材质和风格描述，不要偏离核心意图。', NULL, 'gpt-image-2', '1024x1024', 'standard', '/uploads/1781317775413_0_0kxyw2.png', 'completed', '2026-06-13 02:29:35', 0);
INSERT INTO "images" ("id", "user_id", "prompt", "negative_prompt", "model", "size", "quality", "url", "status", "created_at", "is_public") VALUES (9, 2, '为参考图中的女孩生成现代日系数字插画。干净线稿与绘画感光泽质感并存，兼具超现实主义与元素拟态美学。画面以少女侧面半身像为核心，发丝完全被流动液态水体取代，呈透明、飞溅、甩动中的动态水束，水珠飞溅、折射高光与内部气泡清晰可见，强调流体瞬间凝固的雕塑感，但是仍然要保留原有的头发颜色和纹理。面部肌肤白皙细腻，瞳部大而精致、冷蓝色，着深色简素服装与深色缎带点缀，面颊旁漂浮一颗球形水泡泡，内封小型黄色花朵(类似参考图中人物领结)，形成单一暖色点睛。背景为高明度近白纯色，大量留白，构图轻盈疏朗，信息密度低，视觉重心集中于头部与水元素互动。主光为柔和漫射顶侧光，阴影极淡，水面与肌肤带湿润镜面反射与边缘轮廓光。色调以青、天蓝、钴蓝与乳白为主，辅以一处橙红暖色点缀，饱和清新、对比柔和、曝光偏亮，整体色温偏冷而气质清透。氛围宁静、梦幻、清凉治愈，带水生主题的诗意与空灵感。空间透视简洁，浅景深，主体锐利、背景虚化至近乎消失。动态为侧脸凝视中的流体飞扬定格，水纹呈流线型弧势。后期处理干净无颗粒，轻微高光溢出与水面焦散细节，整体如高品质概念角色插画或商业海报定稿。

在遵循核心意图的同时保留适度创作空间。', NULL, 'gpt-image-2', '1024x1024', 'standard', '/uploads/1781319493137_0_p1x2py.png', 'completed', '2026-06-13 02:58:13', 1);
INSERT INTO "images" ("id", "user_id", "prompt", "negative_prompt", "model", "size", "quality", "url", "status", "created_at", "is_public") VALUES (10, 1, 'A 20-year-old East Asian girl with delicate, charming features and large, bright brown eyes—expressive and lively, with a cheerful or subtly smiling expression. Her naturally wavy long hair is either loose or tied in twin ponytails. She has fair skin and light makeup accentuating her youthful freshness. She wears a modern, cute dress or relaxed outfit in bright, soft colors—lightweight fabric, minimalist cut. She stands indoors at an anime convention, surrounded by banners, posters, or stalls. Lighting is typical indoor illumination—no staged lighting—and the image resembles a casual iPhone snapshot: unpretentious composition, yet brimming with vivid, fresh, youthful charm.

严格遵循主体、构图、材质和风格描述，不要偏离核心意图。

严格遵循主体、构图、材质和风格描述，不要偏离核心意图。', NULL, 'gpt-image-2', '1024x1024', 'standard', '/uploads/1781323151119_0_2o8sde.png', 'completed', '2026-06-13 03:59:11', 1);
INSERT INTO "images" ("id", "user_id", "prompt", "negative_prompt", "model", "size", "quality", "url", "status", "created_at", "is_public") VALUES (13, 1, 'A photorealistic medium shot of a beautiful 23-year-old South Korean office lady (OL) inside a modern elevator. She has charming and captivating eyes looking directly into the camera, elegant makeup. She is wearing a chic and elegant strapless tube top under a stylish open blazer, showcasing a curvaceous and well-proportioned figure. The elevator interior has sleek metallic panels with soft, warm ambient lighting and subtle reflections. Cinematic lighting, photorealistic, 8k resolution, captured on a 35mm lens, realistic skin texture, highly detailed. --ar 3:4 --style raw --v 6.0

严格遵循主体、构图、材质和风格描述，不要偏离核心意图。', NULL, 'gpt-image-2', '1024x1024', 'standard', 'https://pub-0c0a96d4451640d891f0642b17ac8eb2.r2.dev/1781326478446_0_oq0s10.png', 'completed', '2026-06-13 04:54:40', 0);
INSERT INTO "images" ("id", "user_id", "prompt", "negative_prompt", "model", "size", "quality", "url", "status", "created_at", "is_public") VALUES (14, 1, '以明日方舟中的凯尔希为模特，设计VOGUE 时尚杂志封面  ，使用原作的“赛璐璐”、“动画风”平涂画风，禁止过多厚重、繁琐的线条细节；设计艺术杂志独有的那种随性但有张力和艺术感的pose；服饰动作等符合人设；全英文，字体、排版、背景、色彩等经过精细设计，自定义合适的景别和人物特写。反复检查人体结构画面细节等，不要出错

严格遵循主体、构图、材质和风格描述，不要偏离核心意图。', NULL, 'gpt-image-2', '1024x1024', 'standard', 'https://pub-0c0a96d4451640d891f0642b17ac8eb2.r2.dev/1781327566691_0_r9lzyr.png', 'completed', '2026-06-13 05:12:48', 1);

CREATE TABLE logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (1, 1, 'create_account', 'Created account: amieorissette@edu.peterlinux.com', NULL, '2026-06-12 16:48:43');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (2, 1, 'generate_image', 'Generated 1 image: a cute cat...', NULL, '2026-06-12 17:03:00');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (3, 1, 'generate_image', 'Generated 1 image: fetch("http://localhost:8000/api/images/generate",...', NULL, '2026-06-12 17:03:25');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (4, 1, 'generate_image', 'Generated 1 image: fetch("http://localhost:8000/api/images/generate",...', NULL, '2026-06-12 17:03:37');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (5, 1, 'generate_image', 'Generated 1 image: A 20-year-old East Asian girl with delicate, charm...', NULL, '2026-06-12 17:08:15');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (6, 1, 'generate_image', 'Generated 1 image: A 20-year-old East Asian girl with delicate, charm...', NULL, '2026-06-12 17:10:29');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (7, 1, 'delete_account', 'Deleted account ID: 1', NULL, '2026-06-13 01:42:00');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (8, 1, 'create_account', 'Created account: amieorissette@edu.peterlinux.com', NULL, '2026-06-13 01:42:27');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (9, 1, 'delete_account', 'Deleted account ID: 2', NULL, '2026-06-13 02:10:12');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (10, 1, 'create_account', 'Created account: amieorissette@edu.peterlinux.com', NULL, '2026-06-13 02:10:29');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (11, 1, 'login', 'User logged in', '::1', '2026-06-13 02:22:37');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (12, 1, 'delete_account', 'Deleted account ID: 3', NULL, '2026-06-13 02:23:02');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (13, 1, 'create_account', 'Created account: amieorissette@edu.peterlinux.com', NULL, '2026-06-13 02:23:15');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (14, 1, 'generate_image', 'Generated 1/1 image(s): A photorealistic medium shot of a beautiful 23-yea...', NULL, '2026-06-13 02:24:04');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (15, 1, 'generate_image', 'Generated 1/1 image(s): 根据【末日时在做什么？有没有空？可以来拯救吗？】自动生成一张收藏版史诗叙事海报：巨大的【珂朵莉·诺塔...', NULL, '2026-06-13 02:27:51');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (16, 1, 'generate_image', 'Generated 1/1 image(s): Boyfriend’s perspective: Girlfriend is drunk, cosp...', NULL, '2026-06-13 02:29:35');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (17, 1, 'create_user', 'Created user: test', NULL, '2026-06-13 02:36:50');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (18, 1, 'logout', 'User logged out', '::1', '2026-06-13 02:36:53');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (19, 2, 'login', 'User logged in', '::1', '2026-06-13 02:36:57');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (20, 2, 'generate_image', 'Generated 1/1 image(s): 为参考图中的女孩生成现代日系数字插画。干净线稿与绘画感光泽质感并存，兼具超现实主义与元素拟态美学。画...', NULL, '2026-06-13 02:58:13');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (21, 2, 'logout', 'User logged out', '::1', '2026-06-13 02:58:28');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (22, 1, 'login', 'User logged in', '::1', '2026-06-13 02:58:34');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (23, 1, 'update_user', 'Updated user ID: 1', NULL, '2026-06-13 02:58:49');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (24, 1, 'logout', 'User logged out', '::1', '2026-06-13 03:11:28');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (25, 2, 'login', 'User logged in', '::1', '2026-06-13 03:11:34');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (26, 2, 'logout', 'User logged out', '::1', '2026-06-13 03:11:40');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (27, 1, 'login', 'User logged in', '::1', '2026-06-13 03:11:46');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (28, 1, 'checkin', 'Daily checkin +20 credits on 2026-06-13', NULL, '2026-06-13 03:20:51');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (29, 1, 'generate_image', 'Generated 1/1 image(s): A 20-year-old East Asian girl with delicate, charm...', NULL, '2026-06-13 03:59:11');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (30, 1, 'login', 'User logged in', '::1', '2026-06-13 04:33:24');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (31, 1, 'create_account', 'Created account: heron93@edu.peterlinux.com', NULL, '2026-06-13 04:33:45');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (32, 1, 'generate_image', 'Generated 1/1 image(s): A photorealistic medium shot of a beautiful 23-yea...', NULL, '2026-06-13 04:34:45');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (33, 1, 'generate_image', 'Generated 1/1 image(s): A photorealistic medium shot of a beautiful 23-yea...', NULL, '2026-06-13 04:34:53');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (34, 1, 'login', 'User logged in', '::1', '2026-06-13 04:53:50');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (35, 1, 'generate_image', 'Generated 1/1 image(s): A photorealistic medium shot of a beautiful 23-yea...', NULL, '2026-06-13 04:54:40');
INSERT INTO "logs" ("id", "user_id", "action", "details", "ip_address", "created_at") VALUES (36, 1, 'generate_image', 'Generated 1/1 image(s): 以明日方舟中的凯尔希为模特，设计VOGUE 时尚杂志封面  ，使用原作的“赛璐璐”、“动画风”平涂画...', NULL, '2026-06-13 05:12:48');

CREATE TABLE roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      permissions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
INSERT INTO "roles" ("id", "name", "description", "permissions", "created_at") VALUES (1, 'admin', '管理员', '["all"]', '2026-06-12 16:46:31');
INSERT INTO "roles" ("id", "name", "description", "permissions", "created_at") VALUES (2, 'user', '普通用户', '["create","view"]', '2026-06-12 16:46:31');

CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      role TEXT DEFAULT 'user',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    , credits INTEGER DEFAULT 100, last_checkin_date DATE);
INSERT INTO "users" ("id", "username", "password", "email", "role", "status", "created_at", "updated_at", "credits", "last_checkin_date") VALUES (1, 'admin', '$2a$10$RgaZLjRRjlkXHjgpniRCKuLAx9dpLjc9diVMRR3lwWR.CNOf/NmgK', '', 'admin', 'active', '2026-06-12 16:46:31', '2026-06-13 02:58:49', 9999999970, '2026-06-13');
INSERT INTO "users" ("id", "username", "password", "email", "role", "status", "created_at", "updated_at", "credits", "last_checkin_date") VALUES (2, 'test', '$2a$10$5h4J/jKlRLoWg85PeuH0aOTpsZso7oMpqUIArMMUJ36CcnNlHiJYu', '1114724379@qq.com', 'user', 'active', '2026-06-13 02:36:50', '2026-06-13 02:36:50', 90, NULL);

