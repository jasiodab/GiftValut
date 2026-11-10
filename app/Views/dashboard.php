<?php
$d = $dashboard;
$stats = $d['stats'];
$currency = $d['currency'];
$hasProducts = ($stats['totalProducts'] ?? 0) > 0;
$statusQuery = static fn (string $status): string => url('/products?status=' . urlencode($status));
?>
<div class="page-header">
  <div class="page-header-main">
    <h1 class="page-title">Panel</h1>
    <p class="page-desc">Twoje ostatnie znaleziska i rzeczy, które warto kupić.</p>
  </div>
  <div class="page-actions">
    <button class="btn btn-sm" type="button" id="quickAddBtn3"><?= icon('plus') ?> Dodaj produkt</button>
  </div>
</div>

<div class="stats-inline">
  <span class="stat-inline"><strong><?= e($stats['totalProducts']) ?></strong> produktów</span>
  <span class="stat-inline"><strong><?= e($stats['favorites']) ?></strong> ulubionych</span>
  <span class="stat-inline is-accent"><strong><?= e($stats['toBuy']) ?></strong> do kupienia</span>
  <span class="stat-inline"><strong><?= e($stats['purchased']) ?></strong> kupionych</span>
  <span class="stat-inline"><strong><?= e(format_compact_money($stats['totalValue'], $currency)) ?></strong> łączna wartość</span>
</div>

<?php if (!$hasProducts): ?>
  <div class="empty-state">
    <div class="empty-icon"><?= icon('gift') ?></div>
    <h3>Twoja kolekcja jest pusta</h3>
    <p>Dodaj pierwszą rzecz, którą chcesz kupić lub podarować. Link do sklepu wystarczy, żeby zacząć.</p>
    <div class="empty-action">
      <button class="btn btn-sm" type="button" id="quickAddBtn4"><?= icon('plus') ?> Dodaj pierwszy produkt</button>
    </div>
  </div>
<?php else: ?>
  <div class="dash-grid">
    <div class="settings-col">
      <section class="panel">
        <div class="panel-head">
          <div class="panel-head-main">
            <h2 class="panel-title">Do kupienia</h2>
            <p class="panel-desc">Rzeczy gotowe na kolejną okazję</p>
          </div>
          <a class="panel-link" href="<?= e($statusQuery('TO_BUY')) ?>">Wszystkie <?= icon('arrow-right') ?></a>
        </div>
        <div class="panel-body panel-body-flush">
          <div class="list">
            <?php foreach ($d['toBuy'] as $p): ?>
              <div class="list-row">
                <a class="list-thumb" href="<?= e(url('/products/' . $p['id'])) ?>" tabindex="-1" aria-hidden="true">
                  <?php if ($p['imageUrl']): ?>
                    <img src="<?= e(product_image_url($p['imageUrl'])) ?>" alt="" loading="lazy">
                  <?php else: ?>
                    <?= icon('gift') ?>
                  <?php endif; ?>
                </a>
                <div class="list-body">
                  <a class="list-name" href="<?= e(url('/products/' . $p['id'])) ?>"><?= e($p['name']) ?></a>
                  <div class="list-meta">
                    <?php if ($p['category']): ?>
                      <span class="cat-dot" style="background:<?= e($p['category']['color']) ?>"></span>
                      <span><?= e($p['category']['name']) ?></span>
                    <?php endif; ?>
                    <?php if ($p['store']): ?><span class="sep">·</span><span><?= e($p['store']['name']) ?></span><?php endif; ?>
                  </div>
                </div>
                <div class="list-side">
                  <span class="list-price"><?= e(format_money($p['currentPrice'], $p['currency'])) ?></span>
                  <button class="row-action is-primary" type="button" data-mark-bought="<?= e($p['id']) ?>"><?= icon('check') ?> Kupione</button>
                </div>
              </div>
            <?php endforeach; ?>
            <?php if (empty($d['toBuy'])): ?>
              <div class="empty-state compact">
                <div class="empty-icon"><?= icon('shopping-bag') ?></div>
                <p class="empty-desc">Nic nie czeka na zakup. Oznacz produkt jako „Do kupienia”, aby pojawił się tutaj.</p>
              </div>
            <?php endif; ?>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div class="panel-head-main">
            <h2 class="panel-title">Ostatnio dodane</h2>
            <p class="panel-desc">Twoje najnowsze znaleziska</p>
          </div>
          <a class="panel-link" href="<?= e(url('/products')) ?>">Wszystkie <?= icon('arrow-right') ?></a>
        </div>
        <div class="panel-body panel-body-flush">
          <div class="list">
            <?php foreach ($d['recentlyAdded'] as $p): ?>
              <div class="list-row">
                <a class="list-thumb" href="<?= e(url('/products/' . $p['id'])) ?>" tabindex="-1" aria-hidden="true">
                  <?php if ($p['imageUrl']): ?>
                    <img src="<?= e(product_image_url($p['imageUrl'])) ?>" alt="" loading="lazy">
                  <?php else: ?>
                    <?= icon('gift') ?>
                  <?php endif; ?>
                </a>
                <div class="list-body">
                  <a class="list-name" href="<?= e(url('/products/' . $p['id'])) ?>"><?= e($p['name']) ?></a>
                  <div class="list-meta">
                    <span><?= e($p['category']['name'] ?? 'Bez kategorii') ?></span>
                    <?php if (!empty($p['discountPercent'])): ?>
                      <span class="badge badge-danger">-<?= e($p['discountPercent']) ?>%</span>
                    <?php endif; ?>
                  </div>
                </div>
                <div class="list-side">
                  <span class="list-price"><?= e(format_money($p['currentPrice'], $p['currency'])) ?></span>
                  <span class="list-time"><?= e(time_ago($p['createdAt'])) ?></span>
                </div>
              </div>
            <?php endforeach; ?>
          </div>
        </div>
      </section>
    </div>

    <div class="settings-col">
      <section class="panel">
        <div class="panel-head">
          <div class="panel-head-main">
            <h2 class="panel-title">Ulubione</h2>
            <p class="panel-desc">Najbardziej lubiane znaleziska</p>
          </div>
          <a class="panel-link" href="<?= e($statusQuery('FAVORITE')) ?>">Wszystkie <?= icon('arrow-right') ?></a>
        </div>
        <div class="panel-body panel-body-flush">
          <div class="list">
            <?php foreach ($d['favorites'] as $p): ?>
              <div class="list-row">
                <a class="list-thumb" href="<?= e(url('/products/' . $p['id'])) ?>" tabindex="-1" aria-hidden="true">
                  <?php if ($p['imageUrl']): ?>
                    <img src="<?= e(product_image_url($p['imageUrl'])) ?>" alt="" loading="lazy">
                  <?php else: ?>
                    <?= icon('gift') ?>
                  <?php endif; ?>
                </a>
                <div class="list-body">
                  <a class="list-name" href="<?= e(url('/products/' . $p['id'])) ?>"><?= e($p['name']) ?></a>
                  <div class="list-meta">
                    <span><?= e($p['category']['name'] ?? 'Bez kategorii') ?></span>
                    <?php if ($p['store']): ?><span class="sep">·</span><span><?= e($p['store']['name']) ?></span><?php endif; ?>
                  </div>
                </div>
                <div class="list-side">
                  <span class="list-price"><?= e(format_money($p['currentPrice'], $p['currency'])) ?></span>
                </div>
              </div>
            <?php endforeach; ?>
            <?php if (empty($d['favorites'])): ?>
              <div class="empty-state compact">
                <div class="empty-icon"><?= icon('heart') ?></div>
                <p class="empty-desc">Brak ulubionych. Oznacz serduszkiem rzeczy, które podobają Ci się najbardziej.</p>
              </div>
            <?php endif; ?>
          </div>
        </div>
      </section>
    </div>
  </div>
<?php endif; ?>
