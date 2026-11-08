<?php
$p = $product;
$settings = $settings ?? ['currency'=>'PLN'];
?>
<div class="detail-topbar">
  <a class="back-link" href="<?= e(url('/products')) ?>"><?= icon('arrow-left') ?> All products</a>
  <div class="detail-actions">
    <button class="btn btn-outline btn-sm" type="button" id="editProductBtn" data-id="<?= e($p['id']) ?>"><?= icon('pencil') ?> Edit</button>
    <button class="btn btn-destructive btn-sm" type="button" id="deleteProductBtn" data-id="<?= e($p['id']) ?>"><?= icon('trash-2') ?> Delete product</button>
  </div>
</div>

<div class="detail-header">
  <div class="detail-eyebrow">
    <?php if ($p['category']): ?>
      <a href="<?= e(url('/products?categoryId=' . urlencode($p['category']['id']))) ?>">
        <span class="cat-dot" style="background:<?= e($p['category']['color']) ?>"></span>
        <?= e($p['category']['name']) ?>
      </a>
      <span>·</span>
    <?php endif; ?>
    <span><?= e($p['store']['name'] ?? 'Unknown store') ?></span>
  </div>
  <h1 class="detail-title"><?= e($p['name']) ?></h1>
  <div class="detail-sub">
    <span class="status-badge status-<?= e(strtolower(str_replace('_','-',$p['status']))) ?>"><?= icon('dot') ?> <?= e(status_label($p['status'])) ?></span>
    <?php if ($p['availability']): ?>
      <span class="availability availability-in"><?= icon('check') ?> <?= e($p['availability']) ?></span>
    <?php endif; ?>
  </div>
</div>

<div class="detail-grid">
  <div class="detail-media card">
    <div class="product-image" style="aspect-ratio:4/3">
      <?php if ($p['imageUrl']): ?>
        <img src="<?= e(product_image_url($p['imageUrl'])) ?>" alt="<?= e($p['name']) ?>">
      <?php else: ?>
        <div class="product-image-empty"><span><?= icon('gift') ?></span><span>No image</span></div>
      <?php endif; ?>
    </div>
    <div class="image-tools">
      <button class="btn btn-sm" type="button" id="changeImageBtn" data-id="<?= e($p['id']) ?>"><?= icon('image-plus') ?> Change image</button>
      <?php if ($p['imageUrl']): ?>
        <button class="btn btn-sm btn-danger-ghost" type="button" id="removeImageBtn" data-id="<?= e($p['id']) ?>"><?= icon('trash-2') ?></button>
      <?php endif; ?>
    </div>
  </div>

  <div class="detail-grid-side">
    <div class="card price-panel">
      <div class="price-hero">
        <div class="price-hero-main">
          <strong><?= e(format_money($p['currentPrice'], $p['currency'])) ?></strong>
          <?php if ($p['originalPrice'] !== null && $p['currentPrice'] !== null && $p['originalPrice'] > $p['currentPrice']): ?>
            <s><?= e(format_money($p['originalPrice'], $p['currency'])) ?></s>
          <?php endif; ?>
          <?php if (!empty($p['discountPercent'])): ?>
            <span class="product-discount">-<?= e($p['discountPercent']) ?>%</span>
          <?php endif; ?>
        </div>
        <div class="currency-box">
          <span>Currency</span>
          <strong><?= e($p['currency']) ?></strong>
        </div>
      </div>
      <div class="url-box">
        <a href="<?= e($p['url']) ?>" target="_blank" rel="noreferrer"><?= e($p['url']) ?></a>
      </div>
    </div>

    <div class="card">
      <div class="detail-section-head">
        <div><h2>Product details</h2><p>What this gift costs right now</p></div>
      </div>
      <div class="detail-rows">
        <div class="detail-row">
          <?= icon('link') ?>
          <div class="detail-row-label">Store link</div>
          <div class="detail-row-value"><a href="<?= e($p['url']) ?>" target="_blank" rel="noreferrer">Open store <?= icon('arrow-up-right') ?></a></div>
        </div>
        <div class="detail-row">
          <?= icon('tag') ?>
          <div class="detail-row-label">Category</div>
          <div class="detail-row-value"><?= e($p['category']['name'] ?? '—') ?></div>
        </div>
        <div class="detail-row">
          <?= icon('store') ?>
          <div class="detail-row-label">Store</div>
          <div class="detail-row-value"><?= e($p['store']['name'] ?? '—') ?></div>
        </div>
        <div class="detail-row">
          <?= icon('tags') ?>
          <div class="detail-row-label">Tags</div>
          <div class="detail-row-value">
            <?php if (!empty($p['tags'])): ?>
              <div class="tag-list">
                <?php foreach ($p['tags'] as $t): ?>
                  <span class="tag-pill"><?= e($t) ?></span>
                <?php endforeach; ?>
              </div>
            <?php else: ?>
              —
            <?php endif; ?>
          </div>
        </div>
        <?php if ($p['description']): ?>
        <div class="detail-row">
          <?= icon('file-text') ?>
          <div class="detail-row-label">Description</div>
          <div class="detail-row-value"><?= e($p['description']) ?></div>
        </div>
        <?php endif; ?>
      </div>
    </div>

    <div class="card">
      <div class="detail-section-head">
        <div><h2>Private notes</h2><p>Size, colour, occasion or a quiet hint</p></div>
      </div>
      <div class="notes-body">
        <textarea class="textarea" id="notesField" rows="4"><?= e($p['notes'] ?? '') ?></textarea>
        <div class="notes-foot">
          <span class="notes-count" id="notesCount"><?= e(mb_strlen($p['notes'] ?? '')) ?> characters</span>
          <button class="btn btn-sm" type="button" id="saveNotesBtn" data-id="<?= e($p['id']) ?>"><?= icon('save') ?> Save notes</button>
        </div>
      </div>
    </div>
  </div>
</div>