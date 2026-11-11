<?php
$p = $product;
$meta = status_meta($p['status']);
?>
<div class="detail-topbar">
  <a class="back-link" href="<?= e(url('/products')) ?>"><?= icon('arrow-left') ?> Produkty</a>
  <div class="detail-actions">
    <button class="btn btn-outline btn-sm" type="button" id="editProductBtn" data-id="<?= e($p['id']) ?>"><?= icon('pencil') ?> Edytuj</button>
    <button class="btn btn-danger-ghost btn-sm" type="button" id="deleteProductBtn" data-id="<?= e($p['id']) ?>"><?= icon('trash-2') ?> Usuń</button>
  </div>
</div>

<div class="detail-grid">
  <div class="panel detail-media">
    <div class="product-image">
      <?php if ($p['imageUrl']): ?>
        <img src="<?= e(product_image_url($p['imageUrl'])) ?>" alt="<?= e($p['name']) ?>">
      <?php else: ?>
        <div class="product-image-empty"><?= icon('gift') ?><span>Brak zdjęcia</span></div>
      <?php endif; ?>
    </div>
    <div class="image-tools">
      <button class="btn btn-outline btn-sm" type="button" id="changeImageBtn" data-id="<?= e($p['id']) ?>"><?= icon('image-plus') ?> Zmień zdjęcie</button>
      <?php if ($p['imageUrl']): ?>
        <button class="btn btn-ghost btn-sm text-danger" type="button" id="removeImageBtn" data-id="<?= e($p['id']) ?>"><?= icon('trash-2') ?> Usuń zdjęcie</button>
      <?php endif; ?>
    </div>
  </div>

  <div class="detail-side">
    <div class="detail-header">
      <div class="detail-eyebrow">
        <?php if ($p['category']): ?>
          <a href="<?= e(url('/products?categoryId=' . urlencode($p['category']['id']))) ?>">
            <span class="cat-dot" style="background:<?= e($p['category']['color']) ?>"></span>
            <?= e($p['category']['name']) ?>
          </a>
          <span class="sep">·</span>
        <?php endif; ?>
        <span><?= e($p['store']['name'] ?? 'Nieznany sklep') ?></span>
      </div>
      <h1 class="detail-title"><?= e($p['name']) ?></h1>
      <div class="detail-sub">
        <span class="status <?= e($meta['class']) ?>"><span class="dot"></span><?= e($meta['label']) ?></span>
        <?php if ($p['availability']): ?>
          <span class="availability availability-in"><?= icon('check') ?> <?= e($p['availability']) ?></span>
        <?php endif; ?>
      </div>
    </div>

    <div class="panel">
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
          <span>Waluta</span>
          <strong><?= e($p['currency']) ?></strong>
        </div>
      </div>
      <div class="url-box">
        <a href="<?= e($p['url']) ?>" target="_blank" rel="noreferrer noopener"><?= e($p['url']) ?></a>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div class="panel-head-main">
          <h2 class="panel-title">Szczegóły</h2>
          <p class="panel-desc">Najważniejsze informacje o produkcie.</p>
        </div>
      </div>
      <div class="detail-rows">
        <div class="detail-row">
          <div class="detail-row-label"><?= icon('link') ?> Link</div>
          <div class="detail-row-value"><a href="<?= e($p['url']) ?>" target="_blank" rel="noreferrer noopener">Otwórz w sklepie <?= icon('arrow-up-right') ?></a></div>
        </div>
        <div class="detail-row">
          <div class="detail-row-label"><?= icon('tag') ?> Kategoria</div>
          <div class="detail-row-value"><?= e($p['category']['name'] ?? '—') ?></div>
        </div>
        <div class="detail-row">
          <div class="detail-row-label"><?= icon('store') ?> Sklep</div>
          <div class="detail-row-value"><?= e($p['store']['name'] ?? '—') ?></div>
        </div>
        <div class="detail-row">
          <div class="detail-row-label"><?= icon('tags') ?> Tagi</div>
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
            <div class="detail-row-label"><?= icon('file-text') ?> Opis</div>
            <div class="detail-row-value"><?= e($p['description']) ?></div>
          </div>
        <?php endif; ?>
        <div class="detail-row">
          <div class="detail-row-label"><?= icon('calendar') ?> Dodano</div>
          <div class="detail-row-value"><?= e(format_date($p['createdAt'])) ?></div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div class="panel-head-main">
          <h2 class="panel-title">Prywatne notatki</h2>
          <p class="panel-desc">Rozmiar, kolor, okazja albo dyskretna podpowiedź.</p>
        </div>
      </div>
      <div class="notes-body">
        <textarea class="textarea" id="notesField" rows="4" placeholder="Dodaj notatkę…"><?= e($p['notes'] ?? '') ?></textarea>
        <div class="notes-foot">
          <span class="notes-count" id="notesCount"><?= e(mb_strlen($p['notes'] ?? '')) ?> znaków</span>
          <button class="btn btn-sm" type="button" id="saveNotesBtn" data-id="<?= e($p['id']) ?>"><?= icon('save') ?> Zapisz notatki</button>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <div class="panel-head-main">
            <h2 class="panel-title">Historia ceny</h2>
            <p class="panel-desc">Zmiany ceny produktu w czasie.</p>
          </div>
        </div>
        <div class="price-chart-wrap">
          <canvas id="priceChart" width="600" height="300" data-product-id="<?= e($p['id']) ?>"></canvas>
          <p class="price-chart-empty" id="priceChartEmpty" style="display:none">Brak zapisanej historii cen dla tego produktu.</p>
        </div>
      </div>
    </div>
  </div>
</div>
