<?php
$products = $products ?? [];
$pagination = $pagination ?? ['page' => 1, 'totalPages' => 1, 'total' => 0];
$filters = $filters ?? [];
$categories = $categories ?? [];
$settings = $settings ?? ['defaultProductView' => 'grid', 'currency' => 'PLN'];
$view = ($settings['defaultProductView'] ?? 'grid') === 'list' ? 'list' : 'grid';
$hasFilters = ($filters['search'] ?? '') !== ''
    || ($filters['status'] ?? 'ALL') !== 'ALL'
    || ($filters['categoryId'] ?? '') !== ''
    || ($filters['groupId'] ?? '') !== '';
$total = (int) ($pagination['total'] ?? 0);
?>
<div class="page-header">
  <div class="page-header-main">
    <h1 class="page-title">Produkty</h1>
    <p class="page-desc">
      <?php if ($total > 0): ?>
        <?= e($total) ?> <?= e(plural_pl($total, 'zapisany produkt', 'zapisane produkty', 'zapisanych produktów')) ?><?= $hasFilters ? ' spełniających filtry' : ' w Twojej kolekcji' ?>.
      <?php else: ?>
        Wszystkie pomysły na prezenty w jednym miejscu.
      <?php endif; ?>
    </p>
  </div>
  <div class="page-actions">
    <button class="btn" type="button" id="quickAddBtn3"><?= icon('plus') ?> Dodaj produkt</button>
  </div>
</div>

<div class="panel">
  <div class="panel-body">
    <form method="get" action="<?= e(url('/products')) ?>" class="toolbar">
      <?php if (!empty($filters['groupId'])): ?>
        <input type="hidden" name="groupId" value="<?= e($filters['groupId']) ?>">
      <?php endif; ?>

      <div class="search-field">
        <?= icon('search') ?>
        <input class="input" type="search" name="search" value="<?= e($filters['search'] ?? '') ?>" placeholder="Szukaj produktów, sklepów, notatek…" aria-label="Szukaj produktów">
        <?php if (!empty($filters['search'])): ?>
          <button class="search-clear" type="button" onclick="this.form.search.value='';this.form.submit()" aria-label="Wyczyść wyszukiwanie"><?= icon('x') ?></button>
        <?php endif; ?>
      </div>

      <select class="select filter-select" name="status" aria-label="Status" data-auto-submit>
        <option value="ALL" <?= ($filters['status'] ?? 'ALL') === 'ALL' ? 'selected' : '' ?>>Wszystkie statusy</option>
        <option value="TO_CONSIDER" <?= ($filters['status'] ?? '') === 'TO_CONSIDER' ? 'selected' : '' ?>>Do rozważenia</option>
        <option value="FAVORITE" <?= ($filters['status'] ?? '') === 'FAVORITE' ? 'selected' : '' ?>>Ulubione</option>
        <option value="TO_BUY" <?= ($filters['status'] ?? '') === 'TO_BUY' ? 'selected' : '' ?>>Do kupienia</option>
        <option value="PURCHASED" <?= ($filters['status'] ?? '') === 'PURCHASED' ? 'selected' : '' ?>>Kupione</option>
      </select>

      <select class="select filter-select" name="categoryId" aria-label="Kategoria" data-auto-submit>
        <option value="">Wszystkie kategorie</option>
        <?php foreach ($categories as $c): ?>
          <option value="<?= e($c['id']) ?>" <?= ($filters['categoryId'] ?? '') === $c['id'] ? 'selected' : '' ?>><?= e($c['name']) ?></option>
        <?php endforeach; ?>
      </select>

      <select class="select filter-select" name="sort" aria-label="Sortowanie" data-auto-submit>
        <option value="recent" <?= ($filters['sort'] ?? 'recent') === 'recent' ? 'selected' : '' ?>>Najnowsze</option>
        <option value="updated" <?= ($filters['sort'] ?? '') === 'updated' ? 'selected' : '' ?>>Ostatnio zmienione</option>
        <option value="price-asc" <?= ($filters['sort'] ?? '') === 'price-asc' ? 'selected' : '' ?>>Cena: od najniższej</option>
        <option value="price-desc" <?= ($filters['sort'] ?? '') === 'price-desc' ? 'selected' : '' ?>>Cena: od najwyższej</option>
        <option value="name" <?= ($filters['sort'] ?? '') === 'name' ? 'selected' : '' ?>>Nazwa A–Z</option>
      </select>

      <div class="toolbar-end">
        <?php if ($hasFilters): ?>
          <a class="btn btn-ghost btn-sm" href="<?= e(url('/products')) ?>">Wyczyść</a>
        <?php endif; ?>
        <div class="segmented" role="group" aria-label="Widok produktów">
          <button class="segmented-btn <?= $view === 'grid' ? 'active' : '' ?>" type="button" data-view-toggle="grid" aria-label="Widok siatki" aria-pressed="<?= $view === 'grid' ? 'true' : 'false' ?>"><?= icon('layout-grid') ?></button>
          <button class="segmented-btn <?= $view === 'list' ? 'active' : '' ?>" type="button" data-view-toggle="list" aria-label="Widok listy" aria-pressed="<?= $view === 'list' ? 'true' : 'false' ?>"><?= icon('list') ?></button>
        </div>
      </div>
    </form>
  </div>
</div>

<div class="bulk-bar" id="bulkBar" style="display:none">
  <div class="bulk-left">
    <span class="bulk-label">Wybrano <strong id="bulkCount">0</strong></span>
  </div>
  <div class="bulk-actions">
    <select class="select" id="bulkStatus" aria-label="Zmień status zaznaczonych produktów">
      <option value="">Zmień status…</option>
      <option value="TO_CONSIDER">Do rozważenia</option>
      <option value="FAVORITE">Ulubione</option>
      <option value="TO_BUY">Do kupienia</option>
      <option value="PURCHASED">Kupione</option>
    </select>
    <button class="btn btn-danger-ghost btn-sm" type="button" id="bulkDelete"><?= icon('trash-2') ?> Usuń</button>
  </div>
</div>

<?php if (empty($products)): ?>
  <div class="empty-state">
    <div class="empty-icon"><?= icon($hasFilters ? 'search' : 'package') ?></div>
    <h3><?= $hasFilters ? 'Brak produktów dla tych filtrów' : 'Twoja kolekcja jest jeszcze pusta' ?></h3>
    <p><?= $hasFilters ? 'Zmień filtry albo wyczyść wyszukiwanie, aby zobaczyć więcej.' : 'Dodaj pierwszy produkt i zacznij zbierać pomysły na prezenty.' ?></p>
    <div class="empty-action">
      <?php if ($hasFilters): ?>
        <a class="btn btn-outline btn-sm" href="<?= e(url('/products')) ?>">Wyczyść filtry</a>
      <?php else: ?>
        <button class="btn btn-sm" type="button" id="quickAddBtn4"><?= icon('plus') ?> Dodaj produkt</button>
      <?php endif; ?>
    </div>
  </div>
<?php elseif ($view === 'list'): ?>
  <div class="product-list" id="productContainer">
    <?php foreach ($products as $p): ?>
      <?php
      $isFav = $p['status'] === 'FAVORITE';
      $meta = status_meta($p['status']);
      ?>
      <article class="product-row" data-id="<?= e($p['id']) ?>">
        <?php if ($p['url']): ?>
          <a class="product-row-link" href="<?= e($p['url']) ?>" target="_blank" rel="noopener noreferrer" aria-label="Otwórz w sklepie <?= e($p['name']) ?>"></a>
        <?php else: ?>
          <a class="product-row-link" href="<?= e(url('/products/' . $p['id'])) ?>" aria-label="Otwórz <?= e($p['name']) ?>"></a>
        <?php endif; ?>
        <label class="product-row-check">
          <input class="bulk-check" type="checkbox" value="<?= e($p['id']) ?>" aria-label="Zaznacz <?= e($p['name']) ?>">
        </label>
        <div class="product-row-thumb">
          <?php if ($p['imageUrl']): ?>
            <img src="<?= e(product_image_url($p['imageUrl'])) ?>" alt="" loading="lazy">
          <?php else: ?>
            <?= icon('gift') ?>
          <?php endif; ?>
        </div>
        <div class="product-row-body">
          <div class="product-row-name"><?= e($p['name']) ?></div>
          <div class="product-row-meta">
            <?php if ($p['category']): ?>
              <span class="cat-dot" style="background:<?= e($p['category']['color']) ?>"></span>
              <span><?= e($p['category']['name']) ?></span>
              <span class="sep">·</span>
            <?php endif; ?>
            <span><?= e($p['store']['name'] ?? 'Nieznany sklep') ?></span>
          </div>
        </div>
        <div class="product-row-side">
          <span class="status <?= e($meta['class']) ?>"><span class="dot"></span><?= e($meta['label']) ?></span>
          <span class="product-row-price"><?= e(format_money($p['currentPrice'], $p['currency'])) ?></span>
          <button class="icon-btn fav-toggle <?= $isFav ? 'is-favorite' : '' ?>" type="button" data-fav="<?= e($p['id']) ?>" data-status="<?= e($p['status']) ?>" aria-label="<?= $isFav ? 'Usuń z ulubionych' : 'Dodaj do ulubionych' ?>"><?= icon('heart') ?></button>
          <?php if ($p['url']): ?>
            <a class="icon-btn store-link" href="<?= e($p['url']) ?>" target="_blank" rel="noopener noreferrer" aria-label="Otwórz w sklepie <?= e($p['store']['name'] ?? '') ?>"><?= icon('arrow-up-right') ?></a>
          <?php endif; ?>
        </div>
      </article>
    <?php endforeach; ?>
  </div>
<?php else: ?>
  <div class="product-grid" id="productContainer">
    <?php foreach ($products as $p): ?>
      <?php
      $isFav = $p['status'] === 'FAVORITE';
      $meta = status_meta($p['status']);
      ?>
      <article class="product-card" data-id="<?= e($p['id']) ?>">
        <?php if ($p['url']): ?>
          <a class="product-card-link" href="<?= e($p['url']) ?>" target="_blank" rel="noopener noreferrer" aria-label="Otwórz w sklepie <?= e($p['name']) ?>"></a>
        <?php else: ?>
          <a class="product-card-link" href="<?= e(url('/products/' . $p['id'])) ?>" aria-label="Otwórz <?= e($p['name']) ?>"></a>
        <?php endif; ?>
        <div class="product-media">
          <div class="product-image">
            <?php if ($p['imageUrl']): ?>
              <img src="<?= e(product_image_url($p['imageUrl'])) ?>" alt="" loading="lazy">
            <?php else: ?>
              <div class="product-image-empty"><?= icon('gift') ?><span>Brak zdjęcia</span></div>
            <?php endif; ?>
          </div>
          <div class="product-select"><input class="bulk-check" type="checkbox" value="<?= e($p['id']) ?>" aria-label="Zaznacz <?= e($p['name']) ?>"></div>
          <button class="product-fav <?= $isFav ? 'is-favorite' : '' ?>" type="button" data-fav="<?= e($p['id']) ?>" data-status="<?= e($p['status']) ?>" aria-label="<?= $isFav ? 'Usuń z ulubionych' : 'Dodaj do ulubionych' ?>"><?= icon('heart') ?></button>
        </div>
        <div class="product-body">
          <div class="product-meta">
            <?php if ($p['category']): ?>
              <span class="cat-dot" style="background:<?= e($p['category']['color']) ?>"></span>
              <span><?= e($p['category']['name']) ?></span>
              <span class="sep">·</span>
            <?php endif; ?>
            <span class="store"><?= e($p['store']['name'] ?? 'Nieznany sklep') ?></span>
          </div>
          <h3 class="product-name"><?= e($p['name']) ?></h3>
          <div class="product-price-row">
            <div class="product-price">
              <strong><?= e(format_money($p['currentPrice'], $p['currency'])) ?></strong>
              <?php if ($p['originalPrice'] !== null && $p['currentPrice'] !== null && $p['originalPrice'] > $p['currentPrice']): ?>
                <s><?= e(format_money($p['originalPrice'], $p['currency'])) ?></s>
              <?php endif; ?>
              <?php if (!empty($p['discountPercent'])): ?>
                <span class="product-discount">-<?= e($p['discountPercent']) ?>%</span>
              <?php endif; ?>
            </div>
            <span class="status <?= e($meta['class']) ?>"><span class="dot"></span><?= e($meta['label']) ?></span>
          </div>
          <?php if ($p['url']): ?>
            <a class="btn btn-outline btn-sm store-btn" href="<?= e($p['url']) ?>" target="_blank" rel="noopener noreferrer"><?= icon('arrow-up-right') ?> Otwórz w sklepie</a>
          <?php endif; ?>
        </div>
      </article>
    <?php endforeach; ?>
  </div>
<?php endif; ?>

<?php if (!empty($products) && ($pagination['totalPages'] ?? 1) > 1): ?>
  <div class="pagination">
    <p>Strona <strong><?= e($pagination['page']) ?></strong> z <strong><?= e($pagination['totalPages']) ?></strong></p>
    <div class="pagination-controls">
      <?php if ($pagination['page'] > 1): ?>
        <?php $prevQ = http_build_query(array_merge($_GET, ['page' => $pagination['page'] - 1])); ?>
        <a class="btn btn-outline btn-sm" href="<?= e(url('/products?' . $prevQ)) ?>"><?= icon('chevron-left') ?> Poprzednia</a>
      <?php endif; ?>
      <?php if ($pagination['page'] < $pagination['totalPages']): ?>
        <?php $nextQ = http_build_query(array_merge($_GET, ['page' => $pagination['page'] + 1])); ?>
        <a class="btn btn-outline btn-sm" href="<?= e(url('/products?' . $nextQ)) ?>">Następna <?= icon('chevron-right') ?></a>
      <?php endif; ?>
    </div>
  </div>
<?php endif; ?>
