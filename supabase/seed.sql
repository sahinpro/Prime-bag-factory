-- Seed core catalog and config for Prime Bag Factory

insert into public.swatch_groups (id, key, name_en, name_bn, sort_order)
values
  ('7b88aa79-5d76-4f53-9d40-8de9d3122a51', 'fabric', 'Fabric', 'তাঁত', 1),
  ('2d3d90dd-0c39-4d2a-9c78-7d66ed6f7c5a', 'zipper', 'Zipper', 'জিপার', 2),
  ('d2c60ef2-c0fe-4da2-aec0-4663f46d978d', 'puller', 'Zipper Puller', 'জিপার পুলার', 3),
  ('b6472138-c829-4814-b1ec-d26f7fd90ddc', 'lining', 'Lining', 'লাইনিং', 4),
  ('8ee2ec74-9f8e-47df-a7c2-e7f96f4d0c71', 'webbing', 'Strap / Webbing', 'স্ট্র্যাপ / ওয়েবিং', 5),
  ('0bd3cbda-81f4-43f2-8df1-83d82bbf6dff', 'piping', 'Piping', 'পাইপিং', 6),
  ('9b4bc91c-c29d-4d00-a3df-7d1d701d5552', 'thread', 'Thread', 'থ্রেড', 7),
  ('3a2ee42e-7a4d-41f2-9e47-2e64a69a3d33', 'print_ink', 'Print Ink', 'প্রিন্ট ইঙ্ক', 8)
on conflict do nothing;

insert into public.swatches (id, group_id, name_en, name_bn, code, color_hex, sort_order, is_active)
values
  ('4f0d1d13-f391-4e0f-8ca6-e94a595fc65b', '7b88aa79-5d76-4f53-9d40-8de9d3122a51', 'Black', 'কালো', 'FAB-BLK', '#111111', 1, true),
  ('7e588b18-d18f-4f8a-9470-0d1c89947e87', '7b88aa79-5d76-4f53-9d40-8de9d3122a51', 'Ivory', 'আভারি', 'FAB-IVY', '#F5F1E8', 2, true),
  ('c0cb9ea0-f54b-4c20-991d-d8f60a6fe5d2', '7b88aa79-5d76-4f53-9d40-8de9d3122a51', 'Gold', 'সোনালি', 'FAB-GOLD', '#C8A24A', 3, true),
  ('6f8cd7f8-bbb9-429f-a07e-020176628ce0', '2d3d90dd-0c39-4d2a-9c78-7d66ed6f7c5a', 'Black Zipper', 'কালো জিপার', 'ZIP-BLK', '#111111', 1, true),
  ('b0f0db25-3f5f-4a15-b5a9-c5f7f9dd44a7', '2d3d90dd-0c39-4d2a-9c78-7d66ed6f7c5a', 'Silver Zipper', 'সিলভার জিপার', 'ZIP-SLV', '#B0B7BE', 2, true),
  ('d84c8878-13db-4498-a970-2d54d9341d64', '9b4bc91c-c29d-4d00-a3df-7d1d701d5552', 'Thread Beige', 'বেইজ থ্রেড', 'THR-BGE', '#D9C7A0', 1, true)
on conflict do nothing;

insert into public.categories (id, parent_id, slug, name_en, name_bn, description_en, description_bn, sort_order, is_active)
values
  ('c89dd35e-6cf0-4fe0-84cc-aec76fe164a1', null, 'delivery-cold-chain-bags', 'Delivery & Cold-chain Bags', 'ডেলিভারি ও কোল্ড-চেইন ব্যাগ', 'Delivery and insulated bags for food and parcel service.', 'ফুড ও পার্সেল সার্ভিসের ডেলিভারি ও ইন্সুলেটেড ব্যাগ।', 1, true),
  ('a1e2f0e8-62d4-4b7f-a90b-8ddf5df98718', 'c89dd35e-6cf0-4fe0-84cc-aec76fe164a1', 'food-pizza', 'Food & Pizza', 'ফুড ও পিজ্জা', 'Pizza, takeaway and food transport bags.', 'পিজ্জা ও ফুড ট্রান্সপোর্ট ব্যাগ।', 1, true),
  ('b3477e64-0c44-4abe-b8d9-8af0f5403035', 'c89dd35e-6cf0-4fe0-84cc-aec76fe164a1', 'grocery-milk', 'Grocery & Milk', 'মুদিখানা ও দুধ', 'Grocery carry and milk delivery bags.', 'শপিং ও দুধ ডেলিভারি ব্যাগ।', 2, true),
  ('ce7a00d3-fc1f-4218-a6e2-b179e8d0dfad', null, 'backpacks', 'Backpacks', 'ব্যাকপ্যাক', 'Everyday and travel backpacks.', 'ডেইলি ও ট্রাভেল ব্যাকপ্যাক।', 2, true),
  ('8e64dfdb-1575-4b78-84bf-45013edc2a0f', 'ce7a00d3-fc1f-4218-a6e2-b179e8d0dfad', 'laptop-office', 'Laptop & Office', 'ল্যাপটপ ও অফিস', 'Office carry solutions.', 'অফিসের জন্য কেয়ার সলিউশন।', 1, true)
on conflict do nothing;

insert into public.products (
  id, slug, type, title_en, title_bn, short_description_en, short_description_bn,
  description_en, description_bn, material, moq, lead_time_days, stock_mode,
  customization_enabled, status, is_featured, seo_title_en, seo_title_bn,
  seo_description_en, seo_description_bn
)
values (
  'd73595db-6b1d-4b9b-a057-22e3497ca3ef',
  'premium-delivery-bag',
  'buy_now',
  'Premium Delivery Bag',
  'প্রিমিয়াম ডেলিভারি ব্যাগ',
  'Insulated delivery bag for food and groceries.',
  'ফুড ও কাঁচা খাবার ডেলিভারির জন্য ইন্সুলেটেড ব্যাগ।',
  'Heavy-duty insulated delivery bag built for repeated daily use in Bangladesh.',
  'বাংলাদেশের দৈনন্দিন ব্যবহারের জন্য তৈরি হেভি-ডিউটি ইন্সুলেটেড ডেলিভারি ব্যাগ।',
  '600D polyester with insulated lining',
  5,
  7,
  'tracked',
  true,
  'published',
  true,
  'Premium Delivery Bag | Prime Bag Factory',
  'প্রিমিয়াম ডেলিভারি ব্যাগ | Prime Bag Factory',
  'Bulk and retail insulated delivery bags for food, grocery and parcel delivery in Bangladesh.',
  'বাংলাদেশে ফুড, মুদি ও পার্সেল ডেলিভারির জন্য বাল্ক ও রিটেইল ইন্সুলেটেড ডেলিভারি ব্যাগ।'
)
on conflict do nothing;

insert into public.product_categories (id, product_id, category_id, is_primary)
values (
  'c1ae5d28-2711-4192-9353-c27eb952c599', 'd73595db-6b1d-4b9b-a057-22e3497ca3ef', 'c89dd35e-6cf0-4fe0-84cc-aec76fe164a1', true),
  ('6fd8fd54-b977-4f3f-b914-a4d52dbfcbce', 'd73595db-6b1d-4b9b-a057-22e3497ca3ef', 'a1e2f0e8-62d4-4b7f-a90b-8ddf5df98718', false)
on conflict do nothing;

insert into public.price_tiers (id, product_id, min_qty, max_qty, unit_price)
values
  ('3d1ba8d5-7d57-43a7-ac1a-66c19e66eb55', 'd73595db-6b1d-4b9b-a057-22e3497ca3ef', 5, 50, 420.00),
  ('af29d9d9-8122-4181-bc8f-fcf10aeaba8f', 'd73595db-6b1d-4b9b-a057-22e3497ca3ef', 51, 100, 390.00),
  ('f6f8d233-7ad5-4d58-8a91-180fc1f0adb8', 'd73595db-6b1d-4b9b-a057-22e3497ca3ef', 101, null, 360.00)
on conflict do nothing;

insert into public.product_variants (id, product_id, sku, swatch_id, color_name, color_hex, size, price_delta, stock_qty, reserved_qty, low_stock_threshold, is_active)
values
  ('0cdd4b44-554a-48a9-bc50-90f24593b3d2', 'd73595db-6b1d-4b9b-a057-22e3497ca3ef', 'PBF-DEL-BLK-12', '4f0d1d13-f391-4e0f-8ca6-e94a595fc65b', 'Black', '#111111', '12 inch', 0, 85, 0, 15, true),
  ('d1fe6daa-82eb-42d4-bf1c-02e822829650', 'd73595db-6b1d-4b9b-a057-22e3497ca3ef', 'PBF-DEL-IVY-12', '7e588b18-d18f-4f8a-9470-0d1c89947e87', 'Ivory', '#F5F1E8', '12 inch', 25, 40, 0, 10, true)
on conflict do nothing;

insert into public.product_custom_parts (id, product_id, key, label_en, label_bn, input_type, swatch_group_id, is_required, price_delta, config, help_text_en, help_text_bn, sort_order)
values
  ('0f3d7f0c-3268-4cdd-8d5b-82efba5a6b05', 'd73595db-6b1d-4b9b-a057-22e3497ca3ef', 'body_fabric', 'Body fabric', 'বডি ফ্যাব্রিক', 'swatch', '7b88aa79-5d76-4f53-9d40-8de9d3122a51', true, 0, '{"allow_multiple": false}', 'Choose the main body fabric.', 'মূল বডির কাপড় নির্বাচন করুন।', 1),
  ('8c9e6356-4cb2-43fe-9e61-2735174df3e8', 'd73595db-6b1d-4b9b-a057-22e3497ca3ef', 'zipper', 'Zipper', 'জিপার', 'swatch', '2d3d90dd-0c39-4d2a-9c78-7d66ed6f7c5a', true, 0, '{"allow_multiple": false}', 'Select the zipper finish.', 'জিপার ফিনিশ নির্বাচন করুন।', 2),
  ('ef3de0c3-57d6-4f0c-9d58-522073afe36a', 'd73595db-6b1d-4b9b-a057-22e3497ca3ef', 'size', 'Size', 'সাইজ', 'select', null, true, 0, '{"options":["Small","Medium","Large"]}', 'Pick a standard size.', 'স্ট্যান্ডার্ড সাইজ নির্বাচন করুন।', 3)
on conflict do nothing;

insert into public.shipping_zones (id, name_en, name_bn, fee, free_over, is_active)
values
  ('d27fdd0d-4d2b-4dc9-b0ea-6f6d980dcfb8', 'Dhaka Metro', 'ঢাকা মেট্রো', 60.00, 2000.00, true),
  ('5b0c5eb8-8e92-4283-9d57-b3602517738a', 'Outside Dhaka', 'ঢাকার বাইরে', 120.00, 3000.00, true)
on conflict do nothing;

insert into public.settings (id, key, value)
values
  ('4bb7d420-5342-4364-b4bd-e354c5237b07', 'company', '{"name":"Prime Bag Factory","phone":"+8801700000000","email":"info@primebagfactorybd.com","whatsapp":"8801700000000"}'),
  ('a9dbf4cb-7fc5-4b31-adf2-34b7ab17ce3d', 'checkout', '{"cod_enabled": true, "checkout_enabled": true, "custom_order_mode": "quote"}')
on conflict do nothing;
